import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, C, Card, Choice, Field, Hero, HeroText, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import {
  addDays, adviseLoan, amortization, dailyMinimum, forecast, formatDateFr, formatFcfa, incomeStats, loanCost, loanToPlanned,
  parseFcfa, pct, remainingOf, repaymentStrategy, simulateEarlyRepayment, USURY_CAPS,
  type AmortizationMethod, type DebtLine, type LenderType, type Loan, type LoanRecord, type Snapshot,
} from '@/domain';

const LENDERS: { value: LenderType; label: string }[] = [
  { value: 'banque', label: 'Banque' }, { value: 'microfinance', label: 'Microfinance' }, { value: 'autre', label: 'Autre' },
];

/** Taux saisi en pourcentage (« 12 » ou « 12,5 ») → décimal. */
function parseRate(t: string): number | null {
  const v = Number(t.replace(',', '.').replace('%', '').trim());
  return Number.isFinite(v) && v >= 0 && v < 100 ? v / 100 : null;
}

/** Mensualités de crédit en cours (première échéance non payée de chacun). */
function currentLoanPayments(loans: LoanRecord[]): number {
  return loans.filter((l) => l.status === 'en_cours').reduce((s, l) => {
    const next = amortization(l, l.extras).find((r) => !l.paid.includes(r.n));
    return s + (next ? next.payment + next.insurance : 0);
  }, 0);
}

/** Premier jour où le crédit crée ou aggrave un manque sur le total du quotidien. */
function firstStrain(snap: Snapshot, loan: Loan): { date: string; caused: number } | null {
  const base = dailyMinimum(forecast(snap), '*');
  const scen = dailyMinimum(forecast(snap, 'standard', loanToPlanned(loan, [])), '*');
  for (const [date, s] of scen) {
    const caused = Math.max(0, -s) - Math.max(0, -(base.get(date) ?? 0));
    if (caused > 0) return { date, caused };
  }
  return null;
}

export default function Credits() {
  const { snapshot } = useFinance();
  if (!snapshot) return <Screen><Title>Crédits</Title></Screen>;
  const loans = snapshot.loans ?? [];
  const open = loans.filter((l) => l.status === 'en_cours');
  const owed = open.reduce((s, l) => {
    const rows = amortization(l, l.extras);
    const last = rows.filter((r) => l.paid.includes(r.n)).at(-1);
    return s + (last ? last.remaining : l.principal - l.extras.reduce((a, e) => a + e.amount, 0));
  }, 0);

  return (
    <Screen>
      <Title>Crédits</Title>
      <Hero label="Capital restant dû" value={formatFcfa(owed)}>
        <HeroText>{open.length} crédit{open.length > 1 ? 's' : ''} en cours · mensualités {formatFcfa(currentLoanPayments(loans))}</HeroText>
      </Hero>
      <NewLoan />
      {open.map((l) => <LoanCard key={l.id} loan={l} />)}
      <Strategy />
      {loans.filter((l) => l.status === 'solde').map((l) => (
        <Card key={l.id} tone="ok"><Status tone="ok">{l.label} : soldé</Status></Card>
      ))}
    </Screen>
  );
}

function NewLoan() {
  const { snapshot } = useFinance();
  const snap = snapshot!;
  const everyday = snap.wallets.filter((w) => w.everyday);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [lender, setLender] = useState<LenderType>('banque');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState('12');
  const [fees, setFees] = useState('0');
  const [insurance, setInsurance] = useState('0');
  const [method, setMethod] = useState<AmortizationMethod>('annuite');
  const [first, setFirst] = useState(addDays(snap.today, 30));
  const [walletId, setWalletId] = useState(everyday[0]?.id ?? '');
  const [received, setReceived] = useState<'oui' | 'non'>('oui');
  const w = useWrite('credit');
  const disburse = useWrite('deblocage');
  const createdId = useRef<string | null>(null);

  const loan = useMemo<Loan | null>(() => {
    const p = parseFcfa(principal);
    const r = parseRate(rate);
    const m = Number(months);
    const f = parseFcfa(fees || '0');
    const i = parseFcfa(insurance || '0');
    if (!p || r === null || !(m >= 1 && m <= 600) || f === null || i === null || f >= p || !/^\d{4}-\d{2}-\d{2}$/.test(first)) return null;
    return { id: 'simulation', label: label || 'Crédit', lenderType: lender, principal: p, annualRate: r, months: m, firstDueDate: first, method, fees: f, insuranceMonthly: i, walletId };
  }, [label, lender, principal, rate, months, fees, insurance, method, first, walletId]);

  const income = incomeStats(snap.operations ?? [], snap.today, snap.today).mainMonthly;
  const advice = loan ? adviseLoan(loan, income, currentLoanPayments(snap.loans ?? [])) : null;
  const strain = loan ? firstStrain(snap, loan) : null;

  async function save() {
    if (!loan) return w.setError('Complétez le montant, le taux, la durée et la date de première échéance.');
    if (!label.trim()) return w.setError('Donnez un nom au crédit (ex. Prêt moto).');
    // Un réessai après coupure ne recrée pas le crédit : on garde l'identifiant obtenu.
    if (!createdId.current) {
      const ok = await w.run(async (r) => {
        createdId.current = await r.addLoan({ ...loan, label: label.trim() });
      });
      if (!ok) return;
    }
    if (received === 'oui') {
      const ok = await disburse.run((r, clientKey) => r.recordLoanOperation({
        clientKey, loanId: createdId.current!, installment: 0, amount: loan.principal - loan.fees, walletId, date: snap.today,
      }));
      if (!ok) return; // le crédit existe ; le déblocage pourra être refait depuis sa carte
    }
    createdId.current = null;
    setOpen(false);
  }

  if (!open) return <Button label="Simuler ou ajouter un crédit" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <Label muted>Avant de signer : vérifiez le coût, le taux et votre capacité de remboursement.</Label>
      <Field label="Nom du crédit (ex. Prêt moto)" value={label} onChangeText={setLabel} />
      <Choice label="Prêteur" value={lender} onChange={setLender} options={LENDERS} />
      <Field label="Montant emprunté (F)" value={principal} onChangeText={setPrincipal} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Taux annuel (%)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Durée (mois)" value={months} onChangeText={setMonths} keyboardType="number-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Frais de dossier (F)" value={fees} onChangeText={setFees} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Assurance / mois (F)" value={insurance} onChangeText={setInsurance} keyboardType="number-pad" /></View>
      </View>
      <Choice label="Remboursement" value={method} onChange={setMethod}
        options={[{ value: 'annuite', label: 'Mensualités constantes' }, { value: 'capital_constant', label: 'Capital constant' }]} />
      <Field label="Première échéance (AAAA-MM-JJ)" value={first} onChangeText={setFirst} />
      <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={everyday.map((x) => ({ value: x.id, label: x.name }))} />

      {advice && loan ? (
        <View style={{ gap: 6, paddingTop: 6 }}>
          <Title>{formatFcfa(advice.cost.firstPayment)} / mois</Title>
          <Label>Coût total du crédit : {formatFcfa(advice.cost.totalCost)} (intérêts {formatFcfa(advice.cost.totalInterest)}, assurance {formatFcfa(advice.cost.totalInsurance)}, frais {formatFcfa(advice.cost.fees)})</Label>
          <Label>Vous remboursez {formatFcfa(advice.cost.totalPaid)} pour {formatFcfa(loan.principal)} empruntés, et recevez {formatFcfa(loan.principal - loan.fees)}.</Label>
          <Status tone={advice.usury.above ? 'risque' : 'ok'}>
            Taux effectif global : {pct(advice.cost.teg)} · plafond légal {LENDERS.find((l) => l.value === loan.lenderType)!.label.toLowerCase()} : {pct(USURY_CAPS[loan.lenderType])}
          </Status>
          <Status tone={advice.debtService.above ? 'risque' : 'ok'}>
            {income ? `Mensualités de crédit : ${pct(advice.debtService.ratio)} de votre revenu principal (repère : un tiers, soit ${formatFcfa(advice.debtService.maxPayment)} de mensualité au plus).` : 'Revenu principal inconnu : enregistrez vos revenus pour vérifier la capacité de remboursement.'}
          </Status>
          {strain ? (
            <Status tone="risque">Il manquerait {formatFcfa(strain.caused)} le {formatDateFr(strain.date)} avec ce crédit dans votre calendrier.</Status>
          ) : <Status tone="ok">Aucune échéance de votre calendrier n’est compromise sur 60 jours.</Status>}
          {advice.warnings.filter((x) => !x.startsWith('Le taux') && !x.startsWith('Vos mensualités')).map((x) => <Label key={x} muted>{x}</Label>)}
        </View>
      ) : <Label muted>Renseignez le montant, le taux et la durée pour voir la mensualité et le coût.</Label>}

      <Choice label="J’ai reçu l’argent sur ce portefeuille" value={received} onChange={setReceived}
        options={[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Pas encore (simulation)' }]} />
      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {disburse.error ? <Status tone="risque">Crédit enregistré, mais réception de l’argent non enregistrée : {disburse.error}</Status> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Enregistrer ce crédit" disabled={w.busy || disburse.busy || !loan} onPress={save} /></View>
        <View style={{ flex: 1 }}><Button variant="secondaire" label="Fermer" onPress={() => setOpen(false)} /></View>
      </View>
    </Card>
  );
}

function LoanCard({ loan }: { loan: LoanRecord }) {
  const { snapshot } = useFinance();
  const snap = snapshot!;
  const w = useWrite('credit-op');
  const [table, setTable] = useState(false);
  const [extra, setExtra] = useState('');
  const [extraDate, setExtraDate] = useState(snap.today);
  const [mode, setMode] = useState<'duree' | 'mensualite'>('duree');
  const [penalty, setPenalty] = useState('0');
  const rows = amortization(loan, loan.extras);
  const cost = loanCost(loan, rows);
  const next = rows.find((r) => !loan.paid.includes(r.n));
  const lastPaid = rows.filter((r) => loan.paid.includes(r.n)).at(-1);
  const remaining = lastPaid ? lastPaid.remaining : loan.principal - loan.extras.reduce((a, e) => a + e.amount, 0);
  const progress = Math.round(((loan.principal - remaining) / loan.principal) * 100);
  const amount = parseFcfa(extra);
  const sim = amount && /^\d{4}-\d{2}-\d{2}$/.test(extraDate) && amount <= remaining
    ? simulateEarlyRepayment(loan, { date: extraDate, amount }, { mode, already: loan.extras, penaltyRate: (parseRate(penalty) ?? 0), savingsRate: 0.035 })
    : null;

  return (
    <Card>
      <Label>{loan.label} · {LENDERS.find((l) => l.value === loan.lenderType)!.label} · {pct(loan.annualRate)}</Label>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`${loan.label} remboursé à ${progress} %`}
        accessibilityValue={{ min: 0, max: 100, now: progress }} style={{ height: 10, borderRadius: 5, backgroundColor: C.lavande }}>
        <View style={{ width: `${progress}%`, height: 10, borderRadius: 5, backgroundColor: C.menthe }} />
      </View>
      <Label>Capital restant {formatFcfa(remaining)} sur {formatFcfa(loan.principal)} ({progress} % remboursé)</Label>
      <Label muted>Coût total prévu : {formatFcfa(cost.totalCost)} · fin le {formatDateFr(rows.at(-1)!.date)}</Label>
      {!loan.disbursed ? (
        <>
          <Status tone="attention">Montant pas encore reçu.</Status>
          <Button variant="secondaire" label={`J’ai reçu ${formatFcfa(loan.principal - loan.fees)}`} hint="Montant emprunté moins les frais de dossier" disabled={w.busy}
            onPress={() => w.run((r, clientKey) => r.recordLoanOperation({ clientKey, loanId: loan.id, installment: 0, amount: loan.principal - loan.fees, walletId: loan.walletId, date: snap.today }))} />
        </>
      ) : null}
      {w.error ? <Status tone="risque">{w.error}</Status> : null}

      {next ? (
        <View style={{ gap: 6 }}>
          <Status tone={next.date < snap.today ? 'risque' : 'attention'}>
            Échéance {next.n} : {formatFcfa(next.payment + next.insurance)} le {formatDateFr(next.date)}{next.date < snap.today ? ' · en retard' : ''}
          </Status>
          <Label muted>Dont intérêts {formatFcfa(next.interest)}, capital {formatFcfa(next.principal)}{next.insurance ? `, assurance ${formatFcfa(next.insurance)}` : ''}.</Label>
          <Button label={`Payer l’échéance ${next.n}`} disabled={w.busy}
            onPress={() => w.run((r, clientKey) => r.recordLoanOperation({
              clientKey, loanId: loan.id, installment: next.n, amount: next.payment + next.insurance, walletId: loan.walletId,
              date: next.date < snap.today ? next.date : snap.today,
            }))} />
        </View>
      ) : (
        <Button label="Marquer comme soldé" disabled={w.busy} onPress={() => w.run((r) => r.setLoanStatus(loan.id, 'solde'))} />
      )}

      <Button variant="secondaire" label={table ? 'Masquer le tableau d’amortissement' : 'Tableau d’amortissement'} onPress={() => setTable(!table)} />
      {table ? rows.map((r) => (
        <Label key={r.n} muted={loan.paid.includes(r.n)}>
          {loan.paid.includes(r.n) ? '✓ ' : ''}{r.n}. {formatDateFr(r.date)} · {formatFcfa(r.payment + r.insurance)} (intérêts {formatFcfa(r.interest)}, capital {formatFcfa(r.principal)}) · reste {formatFcfa(r.remaining)}
        </Label>
      )) : null}

      <Label muted>Rembourser plus tôt</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Montant en plus (F)" value={extra} onChangeText={setExtra} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Date (AAAA-MM-JJ)" value={extraDate} onChangeText={setExtraDate} /></View>
      </View>
      <Choice label="Effet" value={mode} onChange={setMode}
        options={[{ value: 'duree', label: 'Finir plus tôt' }, { value: 'mensualite', label: 'Baisser la mensualité' }]} />
      <Field label="Indemnité de remboursement anticipé (% du montant, voir contrat)" value={penalty} onChangeText={setPenalty} keyboardType="decimal-pad" />
      {amount && amount > remaining ? <Status tone="risque">Plus que le capital restant ({formatFcfa(remaining)}).</Status> : null}
      {sim ? (
        <View style={{ gap: 4 }}>
          <Status tone={sim.worthIt ? 'ok' : 'attention'}>
            Intérêts économisés : {formatFcfa(sim.interestSaved)}{sim.penalty ? ` − indemnité ${formatFcfa(sim.penalty)} = ${formatFcfa(sim.netGain)}` : ''}
            {mode === 'duree' ? ` · ${sim.monthsSaved} mois de moins` : ` · nouvelle mensualité ${formatFcfa(sim.newPayment)}`}
          </Status>
          <Label>
            {sim.worthIt
              ? `Plus avantageux que d’épargner la même somme (environ ${formatFcfa(sim.savingsAlternative)} d’intérêts à 3,5 %), si votre fonds d’urgence est déjà constitué.`
              : `Épargner la même somme rapporterait davantage (environ ${formatFcfa(sim.savingsAlternative)}) : gardez-la plutôt de côté.`}
          </Label>
          <Button label="Enregistrer ce remboursement anticipé" disabled={w.busy || extraDate > snap.today}
            hint={extraDate > snap.today ? 'Disponible le jour du versement' : undefined}
            onPress={() => w.run((r, clientKey) => r.recordLoanOperation({ clientKey, loanId: loan.id, installment: null, amount: amount!, walletId: loan.walletId, date: extraDate }))
              .then((ok) => ok && setExtra(''))} />
        </View>
      ) : null}
    </Card>
  );
}

/** Plusieurs dettes : avalanche (taux le plus élevé d'abord) contre boule de neige (plus petit solde d'abord). */
function Strategy() {
  const { snapshot } = useFinance();
  const snap = snapshot!;
  const lines: DebtLine[] = [
    ...(snap.loans ?? []).filter((l) => l.status === 'en_cours').map((l) => {
      const rows = amortization(l, l.extras);
      const last = rows.filter((r) => l.paid.includes(r.n)).at(-1);
      const next = rows.find((r) => !l.paid.includes(r.n));
      return { id: l.id, label: l.label, balance: last ? last.remaining : l.principal, annualRate: l.annualRate, minPayment: next?.payment ?? 0 };
    }),
    ...(snap.debts ?? []).filter((d) => d.direction === 'je_dois' && d.status === 'ouverte')
      .map((d) => ({ id: d.id, label: `Dette envers ${d.person}`, balance: remainingOf(d), annualRate: 0, minPayment: 0 })),
  ].filter((l) => l.balance > 0);
  const minimum = lines.reduce((s, l) => s + l.minPayment, 0);
  const [budget, setBudget] = useState(String(minimum + 20_000));
  if (lines.length < 2) return null;
  const b = parseFcfa(budget) ?? 0;
  const av = repaymentStrategy(lines, b, 'avalanche');
  const sn = repaymentStrategy(lines, b, 'boule_de_neige');
  const name = (id: string) => lines.find((l) => l.id === id)?.label ?? id;

  return (
    <Card>
      <Label muted>Rembourser plusieurs dettes</Label>
      <Field label="Budget mensuel consacré aux dettes (F)" value={budget} onChangeText={setBudget} keyboardType="number-pad" />
      <Label muted>Minimum à payer chaque mois : {formatFcfa(minimum)}.</Label>
      {av.insufficient ? <Status tone="risque">Le budget ne couvre pas les paiements minimaux.</Status> : (
        <>
          <Status tone="ok">Recommandé, méthode avalanche (taux le plus élevé d’abord) : {av.months} mois, {formatFcfa(av.totalInterest)} d’intérêts.</Status>
          <Label>Ordre : {av.order.map(name).join(' → ')}</Label>
          <Label muted>
            Méthode boule de neige (plus petite dette d’abord) : {sn.months} mois, {formatFcfa(sn.totalInterest)} d’intérêts
            {sn.totalInterest > av.totalInterest ? `, soit ${formatFcfa(sn.totalInterest - av.totalInterest)} de plus, mais des dettes soldées plus vite pour garder la motivation.` : '.'}
          </Label>
        </>
      )}
    </Card>
  );
}
