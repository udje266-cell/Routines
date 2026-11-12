import { useState } from 'react';

import { PlannedActions } from '@/components/planned-actions';
import { Card, Choice, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { forecast, formatDateFr, formatFcfa, type ForecastView } from '@/domain';

export default function Calendrier() {
  const { snapshot } = useFinance();
  const [view, setView] = useState<ForecastView>('standard');
  if (!snapshot) return <Screen><Title>Calendrier</Title></Screen>;
  const fc = forecast(snapshot, view);
  // Seules les échéances saisies à la main se confirment ici (dettes, épargne et dépenses mensuelles ont leur écran).
  const own = new Set(snapshot.planned.map((p) => p.id));
  return (
    <Screen>
      <Title>Calendrier · 60 jours</Title>
      <Choice label="Vue" value={view} onChange={setView}
        options={[{ value: 'standard', label: 'Standard' }, { value: 'prudente', label: 'Prudente (sans rentrées attendues)' }]} />
      <Card><Label>Solde réel du quotidien : {formatFcfa(fc.start.total)}</Label></Card>
      {fc.lateIncomes.map((i) => (
        <Card key={i.id} tone="attention">
          <Status tone="attention">Rentrée en retard : {i.label} ({formatFcfa(i.amount)}), attendue le {formatDateFr(i.date)}. Elle est sortie de la prévision jusqu’à confirmation ou replanification.</Status>
          {own.has(i.id) ? <PlannedActions item={i} /> : null}
        </Card>
      ))}
      {fc.events.map((e) => (
        <Card key={e.item.id} tone={e.total < 0 ? 'risque' : undefined}>
          <Label muted>{formatDateFr(e.date)}{e.overdue ? ' · en retard' : ''}</Label>
          <Label>{e.item.label} · {e.item.kind === 'rentree' ? '+' : '−'}{formatFcfa(e.item.amount)}</Label>
          {e.total < 0 ? <Status tone="risque">Total prévu : {formatFcfa(e.total)}</Status> : <Label muted>Total prévu : {formatFcfa(e.total)}</Label>}
          {own.has(e.item.id) && (e.item.kind === 'rentree' || e.date <= snapshot.today) ? <PlannedActions item={e.item} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
