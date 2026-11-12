import { Aide } from '@/components/aide';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, C, Card, Choice, Field, Label, Pill, Screen, Status } from '@/components/ui';
import { AmountField, DateField, DayOfMonthField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import {
  addDays, adviseSavings, formatDateCourt, formatDateFr, formatFcfa, goalRemaining, goalSchedule, incomeStats, parseFcfa, progressOf,
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
  if (!snapshot) return <Screen title="Épargne"><Label muted>Chargement…</Label></Screen>;

  const pockets = snapshot.wallets.filter((w) => !w.everyday);
  const goals = snapshot.goals ?? [];
  const saved = pockets.reduce((s, w) => s + w.balance, 0);
  const { a, st, essentials } = advice(snapshot);
  const capacity = Math.max(0, a.recommended);

  return (
    <Screen title="Épargne" help={<Aide k="epargne" size={26} />}>
      {goals.map((g) => <GoalCard key={g.id} goal={g} capacity={capacity} />)}

      {pockets.length === 0 ? (
        <Card tone="attention">
          <Status tone="attention">Créez d’abord un compte Épargne pour y mettre votre argent de côté.</Status>
          <Button label="Créer mon compte Épargne" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'portefeuille' } })} />
        </Card>
      ) : adding ? (
        <NewGoalForm onDone={() => setAdding(false)} defaults={a.addedDefaultGoal} />
      ) : (
        <Button variant={goals.length ? 'secondaire' : 'primaire'} icon="add" label={goals.length ? 'Nouvel objectif' : 'Créer mon coussin de sécurité'} onPress={() => setAdding(true)} />
      )}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="bulb-outline" size={22} color={C.violet} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte, flex: 1 }}>Combien mettre de côté ?</Text>
        </View>
        <Label>Visez <Text style={{ fontWeight: '800' }}>{formatFcfa(a.recommended)}</Text> par mois, et au moins {formatFcfa(a.minimum)} les mois difficiles.</Label>
        {st.smallMonthly ? (
          <Label>Astuce : à chaque petite somme reçue, mettez-en {Math.round(a.smallIncomeRule.rate * 100)} % de côté tout de suite.</Label>
        ) : null}
        <Label muted>Déjà de côté en tout : {formatFcfa(saved)}. Calcul fait sur vos revenus récents et {formatFcfa(essentials)} de factures sur 30 jours.</Label>
      </Card>
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Choisissez une date.');
    if (!(d >= 1 && d <= 31)) return setError('Jour de versement entre 1 et 31.');
    if (await run((repo) => repo.addGoal({ name: name.trim(), target: value, date, pocketWalletId: pocket, fromWalletId: from || undefined, plannedDay: d })))
      onDone();
  }

  return (
    <Card>
      <Field label="Pour quoi ?" icon="flag-outline" value={name} onChangeText={setName} placeholder="Ex. Coussin de sécurité, moto, mariage" />
      <AmountField label="Combien voulez-vous avoir ?" value={parseFcfa(target)} onChange={(v) => setTarget(v === null ? '' : String(v))} />
      <DateField label="À atteindre pour le" value={date} onChange={setDate} today={snapshot!.today} min={snapshot!.today} />
      <DayOfMonthField label="Mettre de côté le" value={Number(day) || 28} onChange={(d) => setDay(String(d))} />
      <Choice label="Rangé sur" value={pocket} onChange={setPocket} options={pockets.map((w) => ({ value: w.id, label: w.name }))} />
      <Choice label="Pris sur" value={from} onChange={setFrom} options={everyday.map((w) => ({ value: w.id, label: w.name }))} />
      {error ? <Status tone="risque">{error}</Status> : null}
      <Button label="Enregistrer" disabled={busy} onPress={save} />
      <Button label="Fermer" variant="lien" onPress={onDone} />
    </Card>
  );
}

function GoalCard({ goal, capacity }: { goal: SavingsGoal; capacity: number }) {
  const { snapshot } = useFinance();
  const everyday = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [open, setOpen] = useState<null | 'verser' | 'retirer'>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [walletId, setWalletId] = useState(goal.fromWalletId ?? everyday[0]?.id ?? '');
  const mv = useWrite('objectif-mvt');
  const progress = progressOf(goal);
  const pct = Math.min(100, Math.round((progress / goal.target) * 100));
  const schedule = goalSchedule(goal, snapshot!.today, capacity || undefined);
  const next = schedule.installments[0];

  const move = () =>
    amount && open && mv.run((repo, clientKey) => repo.moveGoal({ clientKey, goalId: goal.id, walletId, amount, date: snapshot!.today, withdraw: open === 'retirer' }))
      .then((ok) => { if (ok) { setAmount(null); setOpen(null); } });

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.mentheClair, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={28} color={C.texte} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: C.texte }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{goal.name}</Text>
            <Text style={{ fontSize: 15, color: C.texte }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatFcfa(progress)} sur {formatFcfa(goal.target)}</Text>
          </View>
        </View>
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`${goal.name} : ${pct} %`}
          accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 14, borderRadius: 7, backgroundColor: C.violetClair }}>
          <View style={{ width: `${Math.max(pct, 2)}%`, height: 14, borderRadius: 7, backgroundColor: C.mentheVif }} />
        </View>
        {goalRemaining(goal) === 0 ? <Status tone="ok">Objectif atteint, bravo !</Status> : null}
        {schedule.suggestedDate ? (
          <Status tone="attention">À ce rythme ({formatFcfa(schedule.perInstallment)} par mois), vous l’atteindrez le {formatDateFr(schedule.suggestedDate)}.</Status>
        ) : null}
      </Card>

      {next ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.violetClair, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar-outline" size={24} color={C.texte} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte }}>Prochain versement</Text>
              <Text style={{ fontSize: 16, color: C.texte }}>{formatDateCourt(next.date)}</Text>
              <Pill>{formatFcfa(next.amount)} CFA</Pill>
            </View>
          </View>
        </Card>
      ) : null}

      {open ? (
        <Card>
          <AmountField label={open === 'verser' ? 'Combien mettez-vous de côté ?' : 'Combien retirez-vous ?'} value={amount} onChange={setAmount} autoFocus
            hint={open === 'retirer' ? `Vous avez ${formatFcfa(progress)} sur cet objectif.` : undefined} />
          <Choice label={open === 'verser' ? 'Depuis le compte' : 'Vers le compte'} value={walletId} onChange={setWalletId} options={everyday.map((w) => ({ value: w.id, label: w.name }))} />
          {mv.error ? <Status tone="risque">{mv.error}</Status> : null}
          <Button label="Enregistrer" disabled={mv.busy || !amount} onPress={move} />
          <Button label="Fermer" variant="lien" onPress={() => setOpen(null)} />
        </Card>
      ) : (
        <>
          <Button label="Ajouter un versement" onPress={() => { setAmount(next?.amount ?? null); setOpen('verser'); }} />
          {progress > 0 ? (
            <Pressable onPress={() => setOpen('retirer')} accessibilityRole="button" style={{ alignItems: 'center', padding: 4 }}>
              <Text style={{ color: C.violet, fontWeight: '600', fontSize: 15 }}>Retirer de l’argent</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  );
}
