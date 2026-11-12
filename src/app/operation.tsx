import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AmountField, DateField, TileChoice } from '@/components/inputs';
import { Button, C, Card, Field, Label, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { formatDateFr, formatFcfa, type Operation } from '@/domain';
import { CATEGORY_TILES, categoryLabel, walletIcon } from '@/lib/categories';
import { confirmAction } from '@/lib/confirm';

/** Ce qu'on peut faire d'une opération liée (dette, crédit, objectif, facture du mois). */
function linkedInfo(o: Operation): { why: string; canDelete: boolean } | null {
  if (o.debtId) return { why: 'C’est un remboursement de dette : annulez-le depuis l’onglet Dettes.', canDelete: false };
  if (o.loanId) return { why: 'C’est une opération de crédit : elle peut être supprimée, puis ressaisie si besoin.', canDelete: true };
  if (o.goalId) return { why: 'C’est un mouvement d’épargne : il peut être supprimé, puis refait depuis l’onglet Épargne.', canDelete: true };
  if (o.recurring) return { why: 'C’est le paiement d’une facture du mois : supprimez-le et la facture redeviendra « à payer ».', canDelete: true };
  return null;
}

/** Modifier ou supprimer une entrée ou une sortie. */
export default function OperationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useFinance();
  const op = (snapshot?.operations ?? []).find((o) => o.id === id);
  const wallets = snapshot?.wallets ?? [];
  const [amount, setAmount] = useState<number | null>(op?.amount ?? null);
  const [date, setDate] = useState(op?.date ?? snapshot?.today ?? '2026-01-01');
  const [category, setCategory] = useState(op?.category ?? 'Autre');
  const [walletId, setWalletId] = useState(op?.walletId ?? '');
  const [note, setNote] = useState(op?.label ?? '');
  const w = useWrite('modification');

  if (!snapshot || !op) return <Screen><Label muted>Cette opération n’existe plus.</Label><Button label="Retour" onPress={() => router.back()} /></Screen>;

  const linked = linkedInfo(op);
  const editable = !linked;
  const income = op.kind === 'rentree';
  const kindLabel = op.kind === 'rentree' ? 'Argent reçu' : op.kind === 'sortie' ? 'Dépense' : 'Transfert';
  const accountOptions = wallets.filter((x) => (op.kind === 'transfert' ? true : x.everyday)).map((x) => ({ value: x.id, label: x.name, icon: walletIcon(x.kind) }));

  async function save() {
    if (!amount) return w.setError('Indiquez le montant.');
    if (await w.run((r) => r.updateOperation(op!.id, { amount, date, label: note.trim() || categoryLabel(category), category: op!.kind === 'sortie' ? category : op!.category, walletId })))
      router.back();
  }

  function remove() {
    confirmAction('Supprimer cette opération ?', `${kindLabel} de ${formatFcfa(op!.amount)} du ${formatDateFr(op!.date)}. Vos soldes seront recalculés.`, 'Supprimer',
      () => w.run((r) => r.deleteOperation(op!.id)).then((ok) => ok && router.back()));
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name={income ? 'arrow-down-circle' : op.kind === 'transfert' ? 'swap-horizontal' : 'arrow-up-circle'} size={26}
          color={income ? C.mentheTexte : C.violet} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.texte }}>{kindLabel} du {formatDateFr(op.date)}</Text>
      </View>

      {linked ? (
        <Card tone="attention">
          <Status tone="attention">{linked.why}</Status>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.texte }}>{formatFcfa(op.amount)} CFA · {op.label}</Text>
        </Card>
      ) : (
        <>
          <AmountField label="Montant" value={amount} onChange={setAmount} />
          {op.kind === 'sortie' ? <TileChoice label="Catégorie" rowIcon="pricetag-outline" value={category} onChange={setCategory} options={CATEGORY_TILES} /> : null}
          <TileChoice label={op.kind === 'transfert' ? 'Depuis' : 'Compte'} rowIcon="wallet-outline" value={walletId} onChange={setWalletId} options={accountOptions} />
          <DateField label="Date" value={date} onChange={setDate} today={snapshot.today} max={snapshot.today} />
          <Field label="" icon="document-text-outline" placeholder="Note (facultatif)" value={note} onChangeText={setNote} />
        </>
      )}

      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {editable ? <Button label="Enregistrer les modifications" disabled={w.busy} onPress={save} /> : null}
      {!linked || linked.canDelete ? (
        <Button label="Supprimer cette opération" variant="secondaire" icon="trash-outline" disabled={w.busy} onPress={remove} />
      ) : (
        <Button label="Aller aux dettes" variant="secondaire" onPress={() => router.replace('/dettes')} />
      )}
    </Screen>
  );
}
