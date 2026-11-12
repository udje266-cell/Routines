import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import {
  addDays, adviseSavings, formatDateFr, formatFcfa, parseFcfa, REPERES_ABIDJAN, simulateScenario, spendingPace,
} from '@/domain';

const n = (t: string) => parseFcfa(t) ?? 0;

export default function MonBudget() {
  const { snapshot } = useFinance();
  const today = snapshot?.today ?? '2026-11-12';
  const cycleStart = `${today.slice(0, 8)}01`;
  const cycleEnd = addDays(`${addDays(cycleStart, 32).slice(0, 8)}01`, -1);

  // Hypothèses saisies (exemple : 120 000 F de salaire, ~230 000 F de petites rentrées par mois).
  const [income, setIncome] = useState('120 000');
  const [small, setSmall] = useState('230 000');
  const [essentials, setEssentials] = useState('85 000');
  const [plannedSpend, setPlannedSpend] = useState('120 000');
  const [spentSoFar, setSpentSoFar] = useState('');
  const [smallCount, setSmallCount] = useState('');
  const [months, setMonths] = useState<'6' | '12' | '24'>('12');
  const [rate, setRate] = useState('20');
  const [daily, setDaily] = useState('5 000');

  const advice = useMemo(
    () => adviseSavings({ today, income: n(income), smallIncome: n(small), essentials: n(essentials), goals: [] }),
    [today, income, small, essentials],
  );

  const pace = useMemo(() => {
    const spent = n(spentSoFar);
    if (!spent) return null;
    return spendingPace({
      today, cycleStart, cycleEnd, plannedSpend: n(plannedSpend),
      spends: [{ date: today, amount: spent }],
      extraIncomes: Array.from({ length: n(smallCount) }, () => ({ date: today, amount: 5_000 })),
    });
  }, [today, cycleStart, cycleEnd, plannedSpend, spentSoFar, smallCount]);

  const scenario = useMemo(
    () => simulateScenario({
      months: +months, income: n(income), smallIncome: n(small), essentials: n(essentials),
      dailySpend: n(daily), savingsRate: Math.min(100, n(rate)) / 100, monthlyInflation: REPERES_ABIDJAN.inflationAnnuelle / 12,
    }),
    [months, income, small, essentials, daily, rate],
  );
  const last = scenario.at(-1)!;
  const deficitMonths = scenario.filter((m) => m.balance < 0).length;

  return (
    <Screen>
      <Title>Mon budget</Title>
      <Card>
        <Field label="Revenu principal par mois (F)" value={income} onChangeText={setIncome} keyboardType="number-pad" />
        <Field label="Petites rentrées par mois, estimation (F)" value={small} onChangeText={setSmall} keyboardType="number-pad" />
        <Field label="Charges essentielles par mois (loyer, factures, transport, repas)" value={essentials} onChangeText={setEssentials} keyboardType="number-pad" />
        <Label muted>
          Repères Abidjan : woro-woro {REPERES_ABIDJAN.trajet.woroWoro.join('–')} F le trajet, repas local
          {' '}{formatFcfa(REPERES_ABIDJAN.repasLocal.yopougon)}–{formatFcfa(REPERES_ABIDJAN.repasLocal.cocody)}, studio Cocody/Riviera
          {' '}{REPERES_ABIDJAN.loyerStudio['Cocody/Riviera'].map(formatFcfa).join('–')}.
        </Label>
      </Card>

      <Card tone="ok">
        <Label muted>Épargne recommandée</Label>
        <Title>{formatFcfa(advice.recommended)} / mois</Title>
        <Label>Minimum à tenir : {formatFcfa(advice.minimum)} · reste à vivre : {formatFcfa(advice.leftToLive)}</Label>
        <Status tone="attention">
          Règle des petites coupures : mets {Math.round(advice.smallIncomeRule.rate * 100)} % de côté dès réception, soit ~{formatFcfa(advice.smallIncomeRule.monthly)} / mois.
        </Status>
        {advice.plans.map((p) => (
          <Label key={p.goal.id}>{p.goal.name} : {formatFcfa(p.goal.target)} avant le {formatDateFr(p.suggestedDate ?? p.goal.date)} → {formatFcfa(p.monthly)} / mois</Label>
        ))}
        {advice.notes.map((t) => <Label key={t} muted>{t}</Label>)}
      </Card>

      <Card tone={pace?.status === 'derapage' ? 'risque' : pace?.status === 'attention' ? 'attention' : undefined}>
        <Label muted>Rythme du mois ({formatDateFr(cycleStart)} → {formatDateFr(cycleEnd)})</Label>
        <Field label="Enveloppe du quotidien pour le mois (F)" value={plannedSpend} onChangeText={setPlannedSpend} keyboardType="number-pad" />
        <Field label="Déjà dépensé ce mois (F)" value={spentSoFar} onChangeText={setSpentSoFar} keyboardType="number-pad" />
        <Field label="Nombre de petites sommes reçues ce mois" value={smallCount} onChangeText={setSmallCount} keyboardType="number-pad" />
        {pace ? (
          <>
            <Status tone={pace.status === 'dans_le_plan' ? 'ok' : pace.status === 'attention' ? 'attention' : 'risque'}>
              À ce rythme : {formatFcfa(pace.projectedSpend)} dépensés en fin de mois
              {pace.overrun ? `, soit ${formatFcfa(pace.overrun)} au-delà de l’enveloppe.` : '.'}
            </Status>
            <Label>Budget du jour jusqu’à la fin du mois : {formatFcfa(pace.dailyAllowance)}</Label>
          </>
        ) : <Label muted>Indique ce que tu as déjà dépensé pour voir ta projection de fin de mois.</Label>}
      </Card>

      <Card>
        <Label muted>Simulateur de scénario</Label>
        <Choice label="Durée" value={months} onChange={setMonths} options={[{ value: '6', label: '6 mois' }, { value: '12', label: '12 mois' }, { value: '24', label: '24 mois' }]} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Épargne (%)" value={rate} onChangeText={setRate} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Quotidien / jour (F)" value={daily} onChangeText={setDaily} keyboardType="number-pad" /></View>
        </View>
        <Title>{formatFcfa(last.cumulativeSavings)} épargnés en {months} mois</Title>
        {deficitMonths ? (
          <Status tone="risque">{deficitMonths} mois en découvert : {formatFcfa(-Math.min(...scenario.map((m) => m.balance)))} au pire.</Status>
        ) : <Status tone="ok">Aucun mois en découvert (inflation {REPERES_ABIDJAN.inflationAnnuelle * 100} %/an incluse).</Status>}
        {scenario.filter((m) => m.month % (+months / 6) === 0).map((m) => (
          <Label key={m.month}>Mois {m.month} · dépenses {formatFcfa(m.spend)} · solde {formatFcfa(m.balance)} · épargne {formatFcfa(m.cumulativeSavings)}</Label>
        ))}
      </Card>
    </Screen>
  );
}
