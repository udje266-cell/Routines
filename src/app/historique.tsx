import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { formatDateFr, formatFcfa, parseFcfa, type Operation } from '@/domain';

export default function Historique() {
  const { snapshot } = useFinance();
  const [filter, setFilter] = useState<'tout' | 'sortie' | 'rentree'>('tout');
  if (!snapshot) return <Screen><Title>Historique</Title></Screen>;
  const ops = [...(snapshot.operations ?? [])]
    .filter((o) => filter === 'tout' || o.kind === filter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <Screen>
      <Title>Historique</Title>
      <Choice label="Afficher" value={filter} onChange={setFilter}
        options={[{ value: 'tout', label: 'Tout' }, { value: 'sortie', label: 'Dépenses' }, { value: 'rentree', label: 'Rentrées' }]} />
      <Label muted>120 derniers jours. Corriger ou supprimer une opération recalcule soldes, prévisions et budget.</Label>
      {ops.length === 0 ? <Label>Aucune opération.</Label> : null}
      {ops.map((o) => <OperationRow key={o.id} op={o} />)}
    </Screen>
  );
}

function OperationRow({ op }: { op: Operation }) {
  const { snapshot } = useFinance();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(op.amount));
  const [date, setDate] = useState(op.date);
  const [label, setLabel] = useState(op.label);
  const w = useWrite('historique');
  const wallet = snapshot?.wallets.find((x) => x.id === op.walletId)?.name ?? '';
  const sign = op.kind === 'rentree' ? '+' : op.kind === 'sortie' ? '−' : '⇄';
  const linked = op.debtId ? 'Remboursement de dette : à corriger depuis l’onglet Dettes.' : op.goalId ? 'Mouvement d’épargne : seule la suppression est possible.' : null;

  async function save() {
    const value = parseFcfa(amount);
    if (!value) return w.setError('Montant en francs entiers.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > snapshot!.today) return w.setError('Date passée au format AAAA-MM-JJ.');
    if (await w.run((r) => r.updateOperation(op.id, { amount: value, date, label, category: op.category, walletId: op.walletId }))) setEditing(false);
  }

  return (
    <Card>
      <Label>{sign}{formatFcfa(op.amount)} · {op.label || op.category}</Label>
      <Label muted>
        {formatDateFr(op.date)} · {wallet}{op.category ? ` · ${op.category}` : ''}
        {op.incomeType === 'petite' ? ' · petite somme' : ''}{op.fee ? ` · frais ${formatFcfa(op.fee)}` : ''}
      </Label>
      {editing ? (
        <>
          <Field label="Montant (F)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
          <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
          <Field label="Libellé" value={label} onChangeText={setLabel} />
        </>
      ) : null}
      {linked ? <Label muted>{linked}</Label> : null}
      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {!op.debtId ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!op.goalId ? (
            <View style={{ flex: 1 }}>
              <Button variant="secondaire" label={editing ? 'Enregistrer' : 'Corriger'} disabled={w.busy} onPress={editing ? save : () => setEditing(true)} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button variant="secondaire" label="Supprimer" hint={`Supprime ${op.label} de ${formatFcfa(op.amount)}`} disabled={w.busy}
              onPress={() => w.run((r) => r.deleteOperation(op.id))} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
