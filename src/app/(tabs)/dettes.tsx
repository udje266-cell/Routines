import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { checkPayment, formatDateFr, formatFcfa, paidOf, parseFcfa, remainingOf, type Debt, type DebtDirection } from '@/domain';

const STATUT: Record<Debt['status'], { label: string; tone: 'ok' | 'risque' | 'attention' }> = {
  ouverte: { label: 'En cours', tone: 'attention' },
  reglee: { label: 'Réglée', tone: 'ok' },
  annulee: { label: 'Annulée (saisie par erreur)', tone: 'attention' },
  remise: { label: 'Remise par accord', tone: 'ok' },
};

export default function Dettes() {
  const { snapshot } = useFinance();
  const [tab, setTab] = useState<DebtDirection>('je_dois');
  const [adding, setAdding] = useState(false);
  if (!snapshot) return <Screen><Title>Dettes</Title></Screen>;

  const debts = (snapshot.debts ?? []).filter((d) => d.direction === tab);
  const open = debts.filter((d) => d.status === 'ouverte');
  const total = open.reduce((s, d) => s + remainingOf(d), 0);

  return (
    <Screen>
      <Title>Dettes</Title>
      <Button label="Crédits (banque, microfinance) : simuler, suivre, rembourser" variant="secondaire" onPress={() => router.push('/credits')} />
      <Choice label="Afficher" value={tab} onChange={setTab} options={[{ value: 'je_dois', label: 'Je dois' }, { value: 'on_me_doit', label: 'On me doit' }]} />
      <Card tone={total ? 'attention' : 'ok'}>
        <Label muted>{tab === 'je_dois' ? 'Reste à rembourser' : 'Reste à recevoir'}</Label>
        <Title>{formatFcfa(total)}</Title>
        {tab === 'on_me_doit' ? <Label muted>Une créance est incertaine par défaut : elle n’entre pas dans la vue standard tant que vous ne la marquez pas attendue.</Label> : null}
      </Card>
      {adding ? <NewDebtForm direction={tab} onDone={() => setAdding(false)} /> : (
        <Button label={tab === 'je_dois' ? 'Ajouter une dette' : 'Ajouter une créance'} onPress={() => setAdding(true)} />
      )}
      {debts.length === 0 ? <Label muted>Aucune {tab === 'je_dois' ? 'dette' : 'créance'} enregistrée.</Label> : null}
      {[...open, ...debts.filter((d) => d.status !== 'ouverte')].map((d) => <DebtCard key={d.id} debt={d} />)}
    </Screen>
  );
}

function NewDebtForm({ direction, onDone }: { direction: DebtDirection; onDone: () => void }) {
  const { snapshot } = useFinance();
  const wallets = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const [certainty, setCertainty] = useState<'incertaine' | 'attendue'>('incertaine');
  const { run, busy, error, setError } = useWrite('dette');

  async function save() {
    const value = parseFcfa(amount);
    if (!person.trim()) return setError('Indiquez la personne.');
    if (!value) return setError('Montant en francs entiers.');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date au format AAAA-MM-JJ, ou laissez vide.');
    const ok = await run((repo) => repo.addDebt({
      direction, person: person.trim(), initial: value, dueDate: date || undefined, walletId: walletId || undefined,
      certainty: direction === 'on_me_doit' ? certainty : undefined,
    }));
    if (ok) onDone();
  }

  return (
    <Card>
      <Field label="Personne" value={person} onChangeText={setPerson} />
      <Field label="Montant (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Field label="Date prévue (AAAA-MM-JJ, facultative)" value={date} onChangeText={setDate} />
      <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
      {direction === 'on_me_doit' ? (
        <Choice label="Certitude du remboursement" value={certainty} onChange={setCertainty}
          options={[{ value: 'incertaine', label: 'Incertain' }, { value: 'attendue', label: 'Attendu à cette date' }]} />
      ) : null}
      {error ? <Status tone="risque">{error}</Status> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Enregistrer" disabled={busy} onPress={save} /></View>
        <View style={{ flex: 1 }}><Button label="Fermer" variant="secondaire" onPress={onDone} /></View>
      </View>
    </Card>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const { snapshot } = useFinance();
  const wallets = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(debt.walletId ?? wallets[0]?.id ?? '');
  const pay = useWrite('remboursement');
  const st = STATUT[debt.status];
  const rest = remainingOf(debt);
  const value = parseFcfa(amount);
  const localError = amount && value !== null ? checkPayment(debt, value) : amount ? 'Montant invalide.' : null;

  return (
    <Card>
      <Label>{debt.person}</Label>
      <Status tone={st.tone}>{st.label}</Status>
      <Label>Reste {formatFcfa(rest)} sur {formatFcfa(debt.initial)} · payé {formatFcfa(paidOf(debt))}</Label>
      <Label muted>{debt.dueDate ? `Échéance : ${formatDateFr(debt.dueDate)}` : 'Sans date'}{debt.direction === 'on_me_doit' ? ` · ${debt.certainty === 'attendue' ? 'attendue' : 'incertaine'}` : ''}</Label>
      {debt.payments.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}><Label muted>{formatDateFr(p.date)} · {formatFcfa(p.amount)}</Label></View>
          <Button label="Annuler" variant="secondaire" hint={`Annule le paiement de ${formatFcfa(p.amount)} et recalcule le reste`}
            disabled={pay.busy} onPress={() => pay.run((repo) => repo.cancelDebtPayment(p.id))} />
        </View>
      ))}
      {debt.status === 'ouverte' ? (
        <>
          <Field label={debt.direction === 'je_dois' ? 'Montant remboursé (F)' : 'Montant reçu (F)'} value={amount} onChangeText={setAmount}
            keyboardType="number-pad" error={localError} />
          <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
          {pay.error ? <Status tone="risque">{pay.error}</Status> : null}
          <Button label="Enregistrer le paiement" disabled={pay.busy || !value || !!localError}
            onPress={async () => {
              if (await pay.run((repo, clientKey) => repo.payDebt({ clientKey, debtId: debt.id, amount: value!, walletId, date: snapshot!.today })))
                setAmount('');
            }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Remise par accord" variant="secondaire" disabled={pay.busy} onPress={() => pay.run((repo) => repo.setDebtStatus(debt.id, 'remise'))} /></View>
            <View style={{ flex: 1 }}><Button label="Annuler la dette" variant="secondaire" disabled={pay.busy} onPress={() => pay.run((repo) => repo.setDebtStatus(debt.id, 'annulee'))} /></View>
          </View>
        </>
      ) : null}
    </Card>
  );
}
