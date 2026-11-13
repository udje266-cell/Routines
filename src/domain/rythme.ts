import { diffDays, type CivilDate } from './dates';
import type { Francs } from './money';

export interface CashFlow {
  date: CivilDate;
  amount: Francs;
}

export interface PaceInput {
  today: CivilDate;
  cycleStart: CivilDate;
  /** Dernier jour du cycle. */
  cycleEnd: CivilDate;
  /** Enveloppe du quotidien prévue pour le cycle (hors charges fixes et épargne). */
  plannedSpend: Francs;
  /** Dépenses réelles du quotidien depuis le début du cycle. */
  spends: CashFlow[];
  /** Rentrées hors revenu principal depuis le début du cycle. */
  extraIncomes: CashFlow[];
  /** Seuil d'une « petite coupure ». */
  smallThreshold?: Francs;
}

export interface PaceReport {
  spent: Francs;
  daysElapsed: number;
  daysLeft: number;
  /** Projection de fin de cycle au rythme actuel. */
  projectedSpend: Francs;
  overrun: Francs;
  /** Ce qu'on peut dépenser par jour d'ici la fin du cycle pour rester dans l'enveloppe. */
  dailyAllowance: Francs;
  smallIncome: { count: number; total: Francs };
  status: 'dans_le_plan' | 'attention' | 'derapage';
}

/** Rythme de dépense : rend visibles les petites sommes reçues et dépensées sans y penser. */
export function spendingPace(p: PaceInput): PaceReport {
  const threshold = p.smallThreshold ?? 10_000;
  const inCycle = (f: CashFlow) => f.date >= p.cycleStart && f.date <= p.today;
  const spent = p.spends.filter(inCycle).reduce((s, f) => s + f.amount, 0);
  const smalls = p.extraIncomes.filter((f) => inCycle(f) && f.amount <= threshold);
  const cycleDays = diffDays(p.cycleStart, p.cycleEnd) + 1;
  const daysElapsed = diffDays(p.cycleStart, p.today) + 1;
  // Aujourd'hui compris, comme safeToSpend et monthPlan.
  const daysLeft = Math.max(0, diffDays(p.today, p.cycleEnd) + 1);
  const projectedSpend = Math.round((spent / daysElapsed) * cycleDays);
  const overrun = Math.max(0, projectedSpend - p.plannedSpend);
  const dailyAllowance = daysLeft === 0 ? 0 : Math.max(0, Math.floor((p.plannedSpend - spent) / daysLeft));
  const ratio = projectedSpend / Math.max(1, p.plannedSpend);
  return {
    spent, daysElapsed, daysLeft, projectedSpend, overrun, dailyAllowance,
    smallIncome: { count: smalls.length, total: smalls.reduce((s, f) => s + f.amount, 0) },
    status: ratio <= 1 ? 'dans_le_plan' : ratio <= 1.15 ? 'attention' : 'derapage',
  };
}

export interface ScenarioParams {
  months: number;
  income: Francs;
  smallIncome: Francs;
  essentials: Francs;
  dailySpend: Francs;
  savingsRate: number;
  /** Croissance mensuelle des prix (inflation annuelle / 12). */
  monthlyInflation?: number;
  startSavings?: Francs;
}

export interface ScenarioMonth {
  month: number;
  income: Francs;
  spend: Francs;
  saved: Francs;
  cumulativeSavings: Francs;
  /** Solde du mois après charges, quotidien et épargne : négatif = découvert. */
  balance: Francs;
}

/** Simulation analyste : trajectoire mois par mois pour comparer des hypothèses. */
export function simulateScenario(s: ScenarioParams): ScenarioMonth[] {
  const out: ScenarioMonth[] = [];
  let cum = s.startSavings ?? 0;
  for (let m = 1; m <= s.months; m++) {
    const k = Math.pow(1 + (s.monthlyInflation ?? 0), m - 1);
    const income = s.income + s.smallIncome;
    const spend = Math.round((s.essentials + s.dailySpend * 30) * k);
    const saved = Math.ceil(income * s.savingsRate);
    cum += saved;
    out.push({ month: m, income, spend, saved, cumulativeSavings: cum, balance: income - spend - saved });
  }
  return out;
}


