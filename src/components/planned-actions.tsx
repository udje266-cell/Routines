import { useState } from 'react';
import { View } from 'react-native';

import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { formatFcfa, type PlannedItem } from '@/domain';

import { confirmAction } from '@/lib/confirm';

import { AmountField, DateField } from './inputs';
import { Button, Status } from './ui';

/**
 * Confirmer une échéance saisie à la main : l'opération réelle remplace la partie prévue
 * (un encaissement partiel laisse le reste prévu). Ou la replanifier.
 */
export function PlannedActions({ item }: { item: PlannedItem }) {
  const { snapshot } = useFinance();
  const today = snapshot!.today;
  const w = useWrite('confirmation');
  const [mode, setMode] = useState<null | 'montant' | 'date'>(null);
  const [amount, setAmount] = useState<number | null>(item.amount);
  const [date, setDate] = useState(today);
  const income = item.kind === 'rentree';

  async function confirm(value: number) {
    const ok = await w.run((r, clientKey) => r.recordOperation({
      clientKey, kind: item.kind, walletId: item.walletId, toWalletId: item.toWalletId, amount: value,
      date: item.date < today ? item.date : today, label: item.label, category: item.category, plannedItemId: item.id,
      incomeType: income ? 'principal' : undefined,
    }));
    if (ok) setMode(null);
  }

  async function reschedule() {
    if (await w.run((r) => r.reschedulePlanned(item.id, date))) setMode(null);
  }

  return (
    <View style={{ gap: 6 }}>
      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {mode === 'montant' ? (
        <>
          <AmountField label={income ? 'Combien avez-vous reçu ?' : 'Combien avez-vous payé ?'} value={amount} onChange={setAmount} />
          {amount !== null && amount < item.amount ? (
            <Status tone="attention">Le reste ({formatFcfa(item.amount - amount)}) restera prévu.</Status>
          ) : null}
          <Button label="Confirmer" disabled={w.busy || !amount} onPress={() => confirm(amount!)} />
        </>
      ) : mode === 'date' ? (
        <>
          <DateField label="Nouvelle date" value={date} onChange={setDate} today={today} min={today} />
          <Button label="Replanifier" disabled={w.busy} onPress={reschedule} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 110 }}>
            <Button label={income ? 'Reçu' : 'Payé'} hint={`${item.label}, ${formatFcfa(item.amount)}`} disabled={w.busy} onPress={() => confirm(item.amount)} />
          </View>
          <View style={{ flex: 1, minWidth: 110 }}><Button variant="secondaire" label="Autre montant" onPress={() => setMode('montant')} /></View>
          <View style={{ flex: 1, minWidth: 110 }}><Button variant="secondaire" label="Replanifier" onPress={() => setMode('date')} /></View>
          <View style={{ flex: 1, minWidth: 110 }}>
            <Button variant="lien" label="Supprimer" icon="trash-outline" disabled={w.busy}
              onPress={() => confirmAction('Supprimer ?', `« ${item.label} » (${formatFcfa(item.amount)}) ne sera plus prévu.`, 'Supprimer',
                () => { void w.run((r) => r.deletePlanned(item.id)); })} />
          </View>
        </View>
      )}
    </View>
  );
}
