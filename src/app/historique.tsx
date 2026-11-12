import { useState } from 'react';
import { Text, View } from 'react-native';

import { OperationLine } from '@/components/operation-line';
import { C, Card, Choice, Label, Screen } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { addDays, formatDateFr, formatFcfa } from '@/domain';

/** Toutes les entrées et sorties, par jour ; toucher une ligne pour la modifier ou la supprimer. */
export default function Historique() {
  const { snapshot } = useFinance();
  const [filter, setFilter] = useState<'tout' | 'sortie' | 'rentree'>('tout');
  if (!snapshot) return <Screen><Label muted>Chargement…</Label></Screen>;
  const today = snapshot.today;
  const ops = [...(snapshot.operations ?? [])]
    .filter((o) => filter === 'tout' || o.kind === filter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const days = [...new Set(ops.map((o) => o.date))];
  const dayTitle = (d: string) => (d === today ? 'Aujourd’hui' : d === addDays(today, -1) ? 'Hier' : formatDateFr(d));

  return (
    <Screen>
      <Choice label="" value={filter} onChange={setFilter}
        options={[{ value: 'tout', label: 'Tout' }, { value: 'sortie', label: 'Dépenses' }, { value: 'rentree', label: 'Reçu' }]} />
      <Label muted>Touchez une ligne pour la modifier ou la supprimer. Vos soldes sont recalculés tout de suite.</Label>
      {ops.length === 0 ? <Label>Aucune opération sur les 4 derniers mois.</Label> : null}
      {days.map((d) => {
        const mine = ops.filter((o) => o.date === d);
        const out = mine.filter((o) => o.kind === 'sortie').reduce((s, o) => s + o.amount, 0);
        return (
          <Card key={d}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.texte }}>{dayTitle(d)}</Text>
              {out ? <Text style={{ fontSize: 14, color: C.secondaire }}>Dépensé : {formatFcfa(out)}</Text> : null}
            </View>
            {mine.map((o) => <OperationLine key={o.id} op={o} wallets={snapshot.wallets} />)}
          </Card>
        );
      })}
    </Screen>
  );
}
