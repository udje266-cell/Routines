import { addDays, type CivilDate, monthlyDate } from './dates';
import type { Francs } from './money';
import type { PlannedItem } from './types';

/**
 * Crédits amortissables : échéancier, coût total, TEG, plafond de l'usure, capacité de remboursement,
 * remboursement anticipé et stratégie de remboursement de plusieurs dettes.
 * Taux exprimés en décimal (0,12 = 12 % par an) ; montants en francs entiers.
 */

export type LenderType = 'banque' | 'microfinance' | 'autre';
export type AmortizationMethod = 'annuite' | 'capital_constant';

/** Plafonds de l'usure UMOA en vigueur depuis le 1er juin 2026 (avis BCEAO du 31 décembre 2025). */
export const USURY_CAPS: Record<LenderType, number> = { banque: 0.14, microfinance: 0.24, autre: 0.24 };

/**
 * Part maximale du revenu consacrée aux remboursements : usage bancaire courant (environ un tiers),
 * utilisé comme repère prudent et non comme règle légale.
 */
export const DEBT_SERVICE_LIMIT = 1 / 3;

export interface Loan {
  id: string;
  label: string;
  lenderType: LenderType;
  principal: Francs;
  annualRate: number;
  months: number;
  /** Date de la première échéance ; les suivantes tombent le même jour chaque mois. */
  firstDueDate: CivilDate;
  method: AmortizationMethod;
  /** Frais de dossier payés au déblocage. */
  fees: Francs;
  /** Assurance par échéance. */
  insuranceMonthly: Francs;
  walletId: string;
}

/** Crédit enregistré : échéances déjà payées et remboursements anticipés. */
export interface LoanRecord extends Loan {
  paid: number[];
  extras: ExtraPayment[];
  status: 'en_cours' | 'solde';
  /** Vrai si le montant a été reçu sur le portefeuille. */
  disbursed: boolean;
}

export interface ExtraPayment {
  date: CivilDate;
  amount: Francs;
}

export interface ScheduleRow {
  n: number;
  date: CivilDate;
  /** Capital + intérêts (hors assurance). */
  payment: Francs;
  interest: Francs;
  principal: Francs;
  insurance: Francs;
  /** Capital restant dû après l'échéance. */
  remaining: Francs;
}

export function dueDate(loan: Pick<Loan, 'firstDueDate'>, n: number): CivilDate {
  const [y, m, d] = loan.firstDueDate.split('-').map(Number);
  const k = m - 1 + (n - 1);
  return monthlyDate(y + Math.floor(k / 12), (k % 12) + 1, d);
}

/** Mensualité constante d'un prêt à annuités, arrondie au franc supérieur. */
export function annuityPayment(principal: Francs, annualRate: number, months: number): Francs {
  const r = annualRate / 12;
  if (r === 0) return Math.ceil(principal / months);
  return Math.ceil((principal * r) / (1 - Math.pow(1 + r, -months)));
}

/**
 * Tableau d'amortissement. Les remboursements anticipés réduisent le capital à leur date ;
 * en mode « durée » la mensualité est conservée et le prêt finit plus tôt, en mode « mensualité »
 * la durée est conservée et la mensualité recalculée.
 */
export function amortization(loan: Loan, extras: ExtraPayment[] = [], mode: 'duree' | 'mensualite' = 'duree'): ScheduleRow[] {
  const r = loan.annualRate / 12;
  const rows: ScheduleRow[] = [];
  let remaining = loan.principal;
  let payment = loan.method === 'annuite' ? annuityPayment(loan.principal, loan.annualRate, loan.months) : 0;
  const constantPrincipal = Math.ceil(loan.principal / loan.months);
  const pending = [...extras].sort((a, b) => (a.date < b.date ? -1 : 1));
  let prev = addDays(loan.firstDueDate, -31);

  for (let n = 1; remaining > 0 && n <= loan.months * 2; n++) {
    const date = dueDate(loan, n);
    // Remboursements anticipés tombés depuis l'échéance précédente.
    let reduced = false;
    while (pending.length && pending[0].date <= date && pending[0].date > prev) {
      remaining = Math.max(0, remaining - pending.shift()!.amount);
      reduced = true;
    }
    if (remaining === 0) break;
    if (reduced && mode === 'mensualite' && loan.method === 'annuite')
      payment = annuityPayment(remaining, loan.annualRate, Math.max(1, loan.months - n + 1));

    const interest = Math.round(remaining * r);
    let principal = loan.method === 'annuite' ? payment - interest : Math.min(constantPrincipal, remaining);
    if (principal >= remaining || n === loan.months) principal = remaining;
    remaining -= principal;
    rows.push({ n, date, payment: principal + interest, interest, principal, insurance: loan.insuranceMonthly, remaining });
    prev = date;
  }
  return rows;
}

export interface LoanCost {
  totalInterest: Francs;
  totalInsurance: Francs;
  fees: Francs;
  /** Intérêts + assurance + frais. */
  totalCost: Francs;
  /** Total réellement remboursé (capital compris). */
  totalPaid: Francs;
  firstPayment: Francs;
  /** TEG approché : taux annuel proportionnel égalisant le net reçu et les versements. */
  teg: number;
}

export function loanCost(loan: Loan, rows = amortization(loan)): LoanCost {
  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  const totalInsurance = rows.reduce((s, x) => s + x.insurance, 0);
  return {
    totalInterest, totalInsurance, fees: loan.fees,
    totalCost: totalInterest + totalInsurance + loan.fees,
    totalPaid: loan.principal + totalInterest + totalInsurance + loan.fees,
    firstPayment: (rows[0]?.payment ?? 0) + loan.insuranceMonthly,
    teg: effectiveRate(loan.principal - loan.fees, rows.map((x) => x.payment + x.insurance)),
  };
}

/** Taux mensuel i tel que net = Σ flux_k / (1+i)^k, par dichotomie ; renvoyé en taux annuel (×12). */
export function effectiveRate(net: Francs, flows: Francs[]): number {
  const pv = (i: number) => flows.reduce((s, f, k) => s + f / Math.pow(1 + i, k + 1), 0);
  if (net <= 0 || flows.length === 0) return 0;
  let lo = 0;
  let hi = 1;
  if (pv(0) <= net) return 0;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > net) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12;
}

export interface LoanAdvice {
  cost: LoanCost;
  usury: { cap: number; above: boolean };
  /** Part du revenu principal mensuel absorbée par toutes les mensualités de crédit. */
  debtService: { ratio: number; limit: number; above: boolean; maxPayment: Francs };
  warnings: string[];
}

/** Conseil avant de signer : coût, plafond de l'usure, capacité de remboursement. */
export function adviseLoan(loan: Loan, mainMonthlyIncome: Francs, otherLoanPayments: Francs = 0): LoanAdvice {
  const cost = loanCost(loan);
  const cap = USURY_CAPS[loan.lenderType];
  const total = cost.firstPayment + otherLoanPayments;
  const ratio = mainMonthlyIncome > 0 ? total / mainMonthlyIncome : Infinity;
  const maxPayment = Math.max(0, Math.floor(mainMonthlyIncome * DEBT_SERVICE_LIMIT) - otherLoanPayments);
  const warnings: string[] = [];
  if (cost.teg > cap)
    warnings.push(`Le taux effectif (${pct(cost.teg)}) dépasse le plafond légal de ${pct(cap)} : demandez des explications au prêteur avant de signer.`);
  if (ratio > DEBT_SERVICE_LIMIT)
    warnings.push(`Vos mensualités absorberaient ${pct(ratio)} de votre revenu principal (repère : un tiers au plus).`);
  if (mainMonthlyIncome === 0) warnings.push('Aucun revenu principal enregistré : la capacité de remboursement ne peut pas être vérifiée.');
  return { cost, usury: { cap, above: cost.teg > cap }, debtService: { ratio, limit: DEBT_SERVICE_LIMIT, above: ratio > DEBT_SERVICE_LIMIT, maxPayment }, warnings };
}

export function pct(x: number): string {
  return `${(Math.round(x * 1000) / 10).toString().replace('.', ',')} %`;
}

export interface EarlyRepaymentResult {
  interestSaved: Francs;
  monthsSaved: number;
  /** Indemnité de remboursement anticipé éventuelle (en % du montant versé). */
  penalty: Francs;
  netGain: Francs;
  /** Ce que la même somme aurait rapporté en épargne sur la durée restante (intérêts simples). */
  savingsAlternative: Francs;
  worthIt: boolean;
  newPayment: Francs;
}

/** « Si je verse X de plus à telle date » : intérêts économisés, mois gagnés, comparaison avec l'épargne. */
export function simulateEarlyRepayment(
  loan: Loan, extra: ExtraPayment, opts: { mode?: 'duree' | 'mensualite'; penaltyRate?: number; savingsRate?: number; already?: ExtraPayment[] } = {},
): EarlyRepaymentResult {
  const already = opts.already ?? [];
  const before = amortization(loan, already, opts.mode);
  const after = amortization(loan, [...already, extra], opts.mode);
  const interestSaved = before.reduce((s, x) => s + x.interest, 0) - after.reduce((s, x) => s + x.interest, 0);
  const remainingMonths = before.filter((x) => x.date >= extra.date).length;
  const penalty = Math.round(extra.amount * (opts.penaltyRate ?? 0));
  const savingsAlternative = Math.round(extra.amount * (opts.savingsRate ?? 0) * (remainingMonths / 12));
  const netGain = interestSaved - penalty;
  const next = after.find((x) => x.date >= extra.date);
  return {
    interestSaved, monthsSaved: before.length - after.length, penalty, netGain, savingsAlternative,
    worthIt: netGain > savingsAlternative, newPayment: next?.payment ?? 0,
  };
}

export interface DebtLine {
  id: string;
  label: string;
  balance: Francs;
  annualRate: number;
  /** Paiement minimal mensuel (mensualité du crédit, ou 0 pour une dette entre proches). */
  minPayment: Francs;
}

export interface StrategyResult {
  strategy: 'avalanche' | 'boule_de_neige';
  months: number;
  totalInterest: Francs;
  /** Ordre dans lequel les dettes sont soldées. */
  order: string[];
  /** Vrai si le budget ne couvre pas les paiements minimaux. */
  insufficient: boolean;
}

/**
 * Remboursement de plusieurs dettes avec un budget mensuel fixe : chaque dette reçoit son minimum,
 * le surplus va à la dette prioritaire (taux le plus élevé pour l'avalanche, solde le plus faible
 * pour la boule de neige). Quand une dette est soldée, son paiement s'ajoute au surplus.
 */
export function repaymentStrategy(debts: DebtLine[], monthlyBudget: Francs, strategy: StrategyResult['strategy']): StrategyResult {
  const live = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const minTotal = live.reduce((s, d) => s + Math.min(d.minPayment, d.balance), 0);
  if (monthlyBudget < minTotal || monthlyBudget <= 0) return { strategy, months: 0, totalInterest: 0, order: [], insufficient: true };
  const rank = (a: DebtLine, b: DebtLine) =>
    strategy === 'avalanche' ? b.annualRate - a.annualRate || a.balance - b.balance : a.balance - b.balance || b.annualRate - a.annualRate;
  const order: string[] = [];
  let totalInterest = 0;
  let months = 0;
  while (live.some((d) => d.balance > 0) && months < 600) {
    months++;
    for (const d of live) {
      if (d.balance <= 0) continue;
      const i = Math.round(d.balance * (d.annualRate / 12));
      d.balance += i;
      totalInterest += i;
    }
    let budget = monthlyBudget;
    for (const d of live) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minPayment, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
    }
    for (const d of [...live].filter((x) => x.balance > 0).sort(rank)) {
      const pay = Math.min(d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      if (budget <= 0) break;
    }
    for (const d of live) if (d.balance <= 0 && !order.includes(d.id)) order.push(d.id);
  }
  return { strategy, months, totalInterest, order, insufficient: false };
}

/** Échéances non réglées d'un crédit → sorties prévues (capital + intérêts + assurance). */
export function loanToPlanned(loan: Loan, paid: number[], extras: ExtraPayment[] = []): PlannedItem[] {
  return amortization(loan, extras)
    .filter((x) => !paid.includes(x.n))
    .map((x) => ({
      id: `credit-${loan.id}-${x.n}`, kind: 'sortie', label: `${loan.label} (échéance ${x.n})`,
      amount: x.payment + x.insurance, date: x.date, walletId: loan.walletId, source: 'dette', category: 'Crédit',
      loan: { loanId: loan.id, n: x.n },
    }));
}
