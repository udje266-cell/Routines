import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, C, Card, Choice, Field, Label, Row, Screen, Status, SummaryCard } from '@/components/ui';
import { AmountField, DateField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, checkPayment, formatDateFr, formatFcfa, paidOf, parseFcfa, remainingOf, type Debt, type DebtDirection } from '@/domain';

const STATUT: Record<Debt['status'], { label: string; tone: 'ok' | 'risque' | 'attention' }> = {
  ouverte: { label: 'En cours', tone: 'attention' },
  reglee: { label: 'Réglée', tone: 'ok' },
  annulee: { label: 'Supprimée', tone: 'attention' },
  remise: { label: 'Effacée par accord', tone: 'ok' },
};

export default function Dettes() {
  const { snapshot } = useFinance();
  const [tab, setTab] = useState<DebtDirection>('je_dois');
  const [adding, setAdding] = useState(false);
  if (!snapshot) return <Screen title="Dettes"><Label muted>Chargement…</Label></Screen>;

  const debts = (snapshot.debts ?? []).filter((d) => d.direction === tab);
  const open = debts.filter((d) => d.status === 'ouverte');
  const total = open.reduce((s, d) => s + remainingOf(d), 0);

  return (
    <Screen title="Dettes">
      <Choice label="" value={tab} onChange={(t) => { setTab(t); setAdding(false); }} options={[{ value: 'je_dois', label: 'Je dois' }, { value: 'on_me_doit', label: 'On me doit' }]} />
      <SummaryCard label={tab === 'je_dois' ? 'Reste à payer' : 'Reste à recevoir'} amount={`${formatFcfa(total)} CFA`} tone={tab === 'je_dois' ? 'lavande' : 'menthe'}>
        {tab === 'on_me_doit' && total ? <Text style={{ fontSize: 14, color: C.secondaire }}>Par prudence, cet argent n’est pas compté dans « Je peux dépenser » tant que vous n’êtes pas sûr de le recevoir.</Text> : null}
      </SummaryCard>
      {adding ? <NewDebtForm direction={tab} onDone={() => setAdding(false)} /> : (
        <Button variant="secondaire" icon="add" label={tab === 'je_dois' ? 'J’ai emprunté à quelqu’un' : 'J’ai prêté à quelqu’un'} onPress={() => setAdding(true)} />
      )}
      {debts.length === 0 ? <Label muted>{tab === 'je_dois' ? 'Vous ne devez rien à personne.' : 'Personne ne vous doit d’argent.'}</Label> : null}
      {[...open, ...debts.filter((d) => d.status !== 'ouverte')].map((d) => <DebtCard key={d.id} debt={d} />)}
      {tab === 'je_dois' ? (
        <Row icon="business-outline" title="Crédits de banque ou microfinance" sub="Voir le vrai coût avant de signer, suivre, rembourser" onPress={() => router.push('/credits')} />
      ) : null}
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
    if (!value) return setError('Indiquez le montant.');
    const ok = await run((repo) => repo.addDebt({
      direction, person: person.trim(), initial: value, dueDate: date || undefined, walletId: walletId || undefined,
      certainty: direction === 'on_me_doit' ? certainty : undefined,
    }));
    if (ok) onDone();
  }

  return (
    <Card>
      <Field label="Qui ?" icon="person-outline" value={person} onChangeText={setPerson} placeholder="Prénom" />
      <AmountField label="Combien ?" value={parseFcfa(amount)} onChange={(v) => setAmount(v === null ? '' : String(v))} />
      {date ? (
        <>
          <DateField label="À rembourser le" value={date} onChange={setDate} today={snapshot!.today} />
          <Button variant="secondaire" label="Pas de date précise" onPress={() => setDate('')} />
        </>
      ) : (
        <Button variant="secondaire" label="Ajouter une date (facultatif)" onPress={() => setDate(addDays(snapshot!.today, 7))} />
      )}
      <Choice label="Compte" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
      {direction === 'on_me_doit' ? (
        <Choice label="Êtes-vous sûr d’être remboursé ?" value={certainty} onChange={setCertainty}
          options={[{ value: 'incertaine', label: 'Pas sûr' }, { value: 'attendue', label: 'Oui, à cette date' }]} />
      ) : null}
      {error ? <Status tone="risque">{error}</Status> : null}
      <Button label="Enregistrer" disabled={busy} onPress={save} />
      <Button label="Fermer" variant="lien" onPress={onDone} />
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bord }}>
      <Text style={{ fontSize: 16, color: C.texte }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte }}>{value}</Text>
    </View>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const { snapshot } = useFinance();
  const wallets = (snapshot?.wallets ?? []).filter((w) => w.everyday);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [walletId, setWalletId] = useState(debt.walletId ?? wallets[0]?.id ?? '');
  const [more, setMore] = useState(false);
  const pay = useWrite('remboursement');
  const st = STATUT[debt.status];
  const rest = remainingOf(debt);
  const localError = amount !== null ? checkPayment(debt, amount) : null;
  const owe = debt.direction === 'je_dois';

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.lavandeClair, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={26} color={C.texte} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.texte, flex: 1 }}>{debt.person}</Text>
        {debt.status !== 'ouverte' ? <Status tone={st.tone}>{st.label}</Status> : null}
      </View>
      {owe ? (
        <>
          <Line label="Dette initiale" value={formatFcfa(debt.initial)} />
          <Line label="Déjà remboursé" value={formatFcfa(paidOf(debt))} />
        </>
      ) : (
        <>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.texte, paddingVertical: 6 }}>{formatFcfa(rest)} CFA</Text>
          <View style={{ height: 1, backgroundColor: C.bord }} />
          <Text style={{ fontSize: 16, color: C.texte, paddingVertical: 4 }}>{debt.certainty === 'attendue' ? 'Remboursement attendu' : 'Rentrée incertaine'}</Text>
        </>
      )}
      {debt.dueDate ? <Text style={{ fontSize: 15, color: C.secondaire }}>À rembourser le {formatDateFr(debt.dueDate)}</Text> : null}

      {debt.status === 'ouverte' && !open ? (
        <Button label={owe ? 'Noter un remboursement' : 'Noter un règlement'} onPress={() => setOpen(true)} />
      ) : null}
      {debt.status === 'ouverte' && open ? (
        <>
          <AmountField label={owe ? 'Combien avez-vous remboursé ?' : 'Combien avez-vous reçu ?'} value={amount} onChange={setAmount} error={localError} autoFocus
            hint={`Il reste ${formatFcfa(rest)}.`} />
          <Choice label="Avec quel compte ?" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
          {pay.error ? <Status tone="risque">{pay.error}</Status> : null}
          <Button label="Enregistrer" disabled={pay.busy || !amount || !!localError}
            onPress={async () => {
              if (await pay.run((repo, clientKey) => repo.payDebt({ clientKey, debtId: debt.id, amount: amount!, walletId, date: snapshot!.today }))) {
                setAmount(null);
                setOpen(false);
              }
            }} />
          <Button label="Fermer" variant="lien" onPress={() => setOpen(false)} />
        </>
      ) : null}

      {debt.payments.length || debt.status === 'ouverte' ? (
        <Pressable onPress={() => setMore(!more)} accessibilityRole="button" accessibilityState={{ expanded: more }}>
          <Text style={{ color: C.violet, fontWeight: '600', fontSize: 15 }}>{more ? '− Moins' : '+ Historique et autres actions'}</Text>
        </Pressable>
      ) : null}
      {more ? (
        <View style={{ gap: 8 }}>
          {debt.payments.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}><Label muted>{formatDateFr(p.date)} · {formatFcfa(p.amount)}</Label></View>
              <Button label="Annuler" variant="lien" hint={`Annule le paiement de ${formatFcfa(p.amount)} et recalcule le reste`}
                disabled={pay.busy} onPress={() => pay.run((repo) => repo.cancelDebtPayment(p.id))} />
            </View>
          ))}
          {debt.status === 'ouverte' ? (
            <>
              <Button label={owe ? 'On m’a fait grâce du reste' : 'Je fais grâce du reste'} variant="secondaire" disabled={pay.busy}
                onPress={() => pay.run((repo) => repo.setDebtStatus(debt.id, 'remise'))} />
              <Button label="Supprimer (saisie par erreur)" variant="lien" disabled={pay.busy} onPress={() => pay.run((repo) => repo.setDebtStatus(debt.id, 'annulee'))} />
            </>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
