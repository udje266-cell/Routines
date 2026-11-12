import { useState } from 'react';
import { View } from 'react-native';

import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { formatFcfa, parseFcfa, type PlannedItem } from '@/domain';

import { Button, Field, Status } from './ui';

/**
 * Confirmer une échéance saisie à la main : l'opération réelle remplace la partie prévue
 * (un encaissement partiel laisse le reste prévu). Ou la replanifier.
 */
export function PlannedActions({ item }: { item: PlannedItem }) {
  const { snapshot } = useFinance();
  const today = snapshot!.today;
  const w = useWrite('confirmation');
  const [mode, setMode] = useState<null | 'montant' | 'date'>(null);
  const [amount, setAmount] = useState(String(item.amount));
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return w.setError('Nouvelle date à partir d’aujourd’hui (AAAA-MM-JJ).');
    if (await w.run((r) => r.reschedulePlanned(item.id, date))) setMode(null);
  }

  return (
    <View style={{ gap: 6 }}>
      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {mode === 'montant' ? (
        <>
          <Field label={income ? 'Montant reçu (F)' : 'Montant payé (F)'} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
          {parseFcfa(amount) !== null && parseFcfa(amount)! < item.amount ? (
            <Status tone="attention">Le reste ({formatFcfa(item.amount - parseFcfa(amount)!)}) restera prévu.</Status>
          ) : null}
          <Button label="Confirmer" disabled={w.busy || !parseFcfa(amount)} onPress={() => confirm(parseFcfa(amount)!)} />
        </>
      ) : mode === 'date' ? (
        <>
          <Field label="Nouvelle date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
          <Button label="Replanifier" disabled={w.busy} onPress={reschedule} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 110 }}>
            <Button label={income ? 'Reçu' : 'Payé'} hint={`${item.label}, ${formatFcfa(item.amount)}`} disabled={w.busy} onPress={() => confirm(item.amount)} />
          </View>
          <View style={{ flex: 1, minWidth: 110 }}><Button variant="secondaire" label="Autre montant" onPress={() => setMode('montant')} /></View>
          <View style={{ flex: 1, minWidth: 110 }}><Button variant="secondaire" label="Replanifier" onPress={() => setMode('date')} /></View>
        </View>
      )}
    </View>
  );
}
