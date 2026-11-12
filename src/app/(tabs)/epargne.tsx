import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, C, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import {
  addDays, adviseSavings, formatDateFr, formatFcfa, goalRemaining, goalSchedule, incomeStats, parseFcfa, progressOf,
  currentCycle, upcomingEssentials, type SavingsGoal, type Snapshot,
} from '@/domain';

function advice(snap: Snapshot) {
  const st = incomeStats(snap.operations ?? [], snap.today, currentCycle(snap).start);
  const essentials = upcomingEssentials(snap);
  const a = adviseSavings({
    today: snap.today, income: st.mainMonthly, smallIncome: st.smallMonthly, essentials,
    goals: (snap.goals ?? []).filter((g) => g.status === 'actif').map((g) => ({ id: g.id, name: g.name, target: g.target, saved: progressOf(g), date: g.date })),
  });
  return { a, st, essentials };
}

export default function Epargne() {
  const { snapshot } = useFinance();
  const [adding, setAdding] = useState(false);
  if (!snapshot) return <Screen><Title>Épargne</Title></Screen>;

  const pockets = snapshot.wallets.filter((w) => !w.everyday);
  const goals = snapshot.goals ?? [];
  const saved = pockets.reduce((s, w) => s + w.balance, 0);
  const { a, st, essentials } = advice(snapshot);
  const capacity = Math.max(0, a.recommended);

  return (
    <Screen>
      <Title>Épargne</Title>
      <Card tone="ok">
        <Label muted>Épargne réellement mise de côté</Label>
        <Title>{formatFcfa(saved)}</Title>
        <Label>Recommandé : {formatFcfa(a.recommended)} / mois (minimum {formatFcfa(a.minimum)})</Label>
        <Label muted>
          Calculé sur vos revenus des 3 derniers mois ({formatFcfa(st.mainMonthly)} de revenu principal + {formatFcfa(st.smallMonthly)} de petites sommes par mois)
          et {formatFcfa(essentials)} de charges prévues sur 30 jours.
        </Label>
        {st.smallMonthly ? (
          <Status tone="attention">Mettez {Math.round(a.smallIncomeRule.rate * 100)} % de chaque petite somme de côté dès réception (~{formatFcfa(a.smallIncomeRule.monthly)} / mois).</Status>
        ) : null}
        {a.notes.map((t) => <Label key={t} muted>{t}</Label>)}
      </Card>

      {pockets.length === 0 ? (
        <Card tone="attention">
          <Status tone="attention">Créez d’abord une poche d’épargne (portefeuille de type Épargne).</Status>
          <Button label="Créer une poche d’épargne" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'portefeuille' } })} />
        </Card>
      ) : adding ? (
        <NewGoalForm onDone={() => setAdding(false)} defaults={a.addedDefaultGoal} />
      ) : (
        <Button label={goals.length ? 'Nouvel objectif' : 'Créer mon fonds d’urgence'} onPress={() => setAdding(true)} />
      )}

      {goals.map((g) => <GoalCard key={g.id} goal={g} capacity={capacity} />)}
    </Screen>
  );
}

function NewGoalForm({ onDone, defaults }: { onDone: () => void; defaults: { name: string; target: number; date: string } | null }) {
  const { snapshot } = useFinance();
  const pockets = (snapshot?.wallets ?? []).filter((w) => !w.everyday);
  const everyday = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [name, setName] = useState(defaults?.name ?? '');
  const [target, setTarget] = useState(defaults ? String(defaults.target) : '');
  const [date, setDate] = useState(defaults?.date ?? addDays(snapshot!.today, 180));
  const [day, setDay] = useState('28');
  const [pocket, setPocket] = useState(pockets[0]?.id ?? '');
  const [from, setFrom] = useState(everyday[0]?.id ?? '');
  const { run, busy, error, setError } = useWrite('objectif');

  async function save() {
    const value = parseFcfa(target);
    const d = Number(day);
    if (!name.trim() || !value) return setError('Nom et somme cible requis.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date au format AAAA-MM-JJ.');
    if (!(d >= 1 && d <= 31)) return setError('Jour de versement entre 1 et 31.');
    if (await run((repo) => repo.addGoal({ name: name.trim(), target: value, date, pocketWalletId: pocket, fromWalletId: from || undefined, plannedDay: d })))
      onDone();
  }

  return (
    <Card>
      <Field label="Nom de l’objectif" value={name} onChangeText={setName} />
      <Field label="Somme cible (F CFA)" value={target} onChangeText={setTarget} keyboardType="number-pad" />
      <Field label="Date visée (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
      <Field label="Jour du mois des versements" value={day} onChangeText={setDay} keyboardType="number-pad" />
      <Choice label="Poche d’épargne" value={pocket} onChange={setPocket} options={pockets.map((w) => ({ value: w.id, label: w.name }))} />
      <Choice label="Versements prévus depuis" value={from} onChange={setFrom} options={everyday.map((w) => ({ value: w.id, label: w.name }))} />
      {error ? <Status tone="risque">{error}</Status> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Enregistrer" disabled={busy} onPress={save} /></View>
        <View style={{ flex: 1 }}><Button label="Fermer" variant="secondaire" onPress={onDone} /></View>
      </View>
    </Card>
  );
}

function GoalCard({ goal, capacity }: { goal: SavingsGoal; capacity: number }) {
  const { snapshot } = useFinance();
  const everyday = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(goal.fromWalletId ?? everyday[0]?.id ?? '');
  const mv = useWrite('objectif-mvt');
  const progress = progressOf(goal);
  const pct = Math.min(100, Math.round((progress / goal.target) * 100));
  const schedule = goalSchedule(goal, snapshot!.today, capacity || undefined);
  const value = parseFcfa(amount);

  const move = (withdraw: boolean) =>
    value && mv.run((repo, clientKey) => repo.moveGoal({ clientKey, goalId: goal.id, walletId, amount: value, date: snapshot!.today, withdraw }))
      .then((ok) => ok && setAmount(''));

  return (
    <Card>
      <Label>{goal.name}</Label>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`${goal.name} : ${pct} %`}
        accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 10, borderRadius: 5, backgroundColor: C.lavande }}>
        <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: C.menthe }} />
      </View>
      <Label>{formatFcfa(progress)} sur {formatFcfa(goal.target)} ({pct} %) · reste {formatFcfa(goalRemaining(goal))}</Label>
      <Label muted>Objectif : {formatDateFr(goal.date)}</Label>
      {goalRemaining(goal) === 0 ? <Status tone="ok">Objectif atteint.</Status> : schedule.installments.length ? (
        <>
          <Label>Prochains versements prévus : {schedule.installments.slice(0, 3).map((i) => `${formatDateFr(i.date)} ${formatFcfa(i.amount)}`).join(' · ')}</Label>
          {schedule.suggestedDate ? (
            <Status tone="attention">
              {goal.date < snapshot!.today ? 'Date dépassée' : 'Au-delà de votre capacité'} : échéancier ajusté à {formatFcfa(schedule.perInstallment)} / mois, objectif atteint le {formatDateFr(schedule.suggestedDate)}.
            </Status>
          ) : null}
        </>
      ) : null}
      <Field label="Montant (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Choice label="Portefeuille du quotidien" value={walletId} onChange={setWalletId} options={everyday.map((w) => ({ value: w.id, label: w.name }))} />
      {mv.error ? <Status tone="risque">{mv.error}</Status> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Verser" disabled={mv.busy || !value} onPress={() => move(false)} /></View>
        <View style={{ flex: 1 }}><Button label="Retirer" variant="secondaire" disabled={mv.busy || !value} onPress={() => move(true)} /></View>
      </View>
    </Card>
  );
}
