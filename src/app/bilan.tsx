import { useState } from 'react';

import { Card, Choice, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { addDays, currentCycle, cycleBounds, cycleReview, formatDateFr, formatFcfa } from '@/domain';

export default function Bilan() {
  const { snapshot } = useFinance();
  const [which, setWhich] = useState<'courant' | 'precedent'>('courant');
  if (!snapshot) return <Screen><Title>Bilan</Title></Screen>;
  const cur = currentCycle(snapshot);
  const bounds = which === 'courant' ? cur : cycleBounds(addDays(cur.start, -1), snapshot.cycle ?? { startDay: 1 });
  const pockets = snapshot.wallets.filter((w) => !w.everyday).map((w) => w.id);
  const r = cycleReview(snapshot.categories ?? [], snapshot.operations ?? [], snapshot.intents ?? [], bounds, pockets);
  const income = r.income.main + r.income.small;

  return (
    <Screen>
      <Title>Bilan du cycle</Title>
      <Choice label="Cycle" value={which} onChange={setWhich} options={[{ value: 'courant', label: 'En cours' }, { value: 'precedent', label: 'Précédent' }]} />
      <Label muted>Du {formatDateFr(bounds.start)} au {formatDateFr(bounds.end)}</Label>

      <Card>
        <Label muted>Rentrées</Label>
        <Title>{formatFcfa(income)}</Title>
        <Label>Revenu principal {formatFcfa(r.income.main)} · petites sommes {formatFcfa(r.income.small)}</Label>
        {r.income.small > r.income.main ? <Status tone="attention">Les petites sommes dépassent votre revenu principal : elles méritent un suivi aussi attentif.</Status> : null}
      </Card>

      <Card tone={r.spending > income ? 'risque' : undefined}>
        <Label muted>Dépenses du quotidien</Label>
        <Title>{formatFcfa(r.spending)}</Title>
        {r.spending > income ? <Status tone="risque">Vous avez dépensé {formatFcfa(r.spending - income)} de plus que vos rentrées.</Status> : null}
      </Card>

      <Card>
        <Label muted>Enveloppes : prévu / réel</Label>
        {r.categories.length === 0 ? <Label>Aucun plafond défini (Mon budget → Enveloppes).</Label> : null}
        {r.categories.map((c) => (
          <Status key={c.category} tone={c.status === 'depasse' ? 'risque' : c.status === 'presque' ? 'attention' : 'ok'}>
            {c.category}{c.pleasure ? ' (plaisir)' : ''} : {formatFcfa(c.spent)} / {formatFcfa(c.cap)}
            {c.left < 0 ? ` · dépassé de ${formatFcfa(-c.left)}` : ''}
          </Status>
        ))}
      </Card>

      <Card>
        <Label muted>Dettes</Label>
        <Label>Remboursé : {formatFcfa(r.debtsPaid)} · reçu : {formatFcfa(r.debtsReceived)}</Label>
      </Card>

      <Card tone="ok">
        <Label muted>Épargne réellement versée</Label>
        <Title>{formatFcfa(r.saved)}</Title>
        <Label muted>
          Achats abandonnés : {r.abandoned.count} pour {formatFcfa(r.abandoned.total)}. Ils ne sont pas comptés comme épargne :
          versez la somme sur un objectif pour qu’elle le devienne.
        </Label>
      </Card>
    </Screen>
  );
}
