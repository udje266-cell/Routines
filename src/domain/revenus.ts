import { addDays, diffDays, type CivilDate } from './dates';
import type { Francs } from './money';
import type { CashFlow } from './rythme';

/** Opération réelle confirmée (historique). */
export interface Operation {
  id: string;
  kind: 'sortie' | 'rentree' | 'transfert';
  walletId: string;
  toWalletId?: string;
  amount: Francs;
  fee?: Francs;
  date: CivilDate;
  label: string;
  category?: string;
  /** Rentrée : revenu principal ou petite somme (coupures, dépannages, ventes…). */
  incomeType?: 'principal' | 'petite';
  debtId?: string;
  goalId?: string;
}

export interface IncomeStats {
  /** Moyenne mensuelle sur l'historique disponible, au plus les 3 derniers mois (90 jours). */
  mainMonthly: Francs;
  smallMonthly: Francs;
  /** Flux du cycle courant pour le rythme de dépense. */
  cycleSpends: CashFlow[];
  cycleSmallIncomes: CashFlow[];
  cycleMain: Francs;
}

/**
 * Statistiques tirées de l'historique. Les remboursements de dettes et l'épargne ne sont pas des dépenses
 * du quotidien ; seuls les frais de transfert en sont.
 */
export function incomeStats(ops: Operation[], today: CivilDate, cycleStart: CivilDate): IncomeStats {
  const from90 = addDays(today, -89);
  const recent = ops.filter((o) => o.date >= from90 && o.date <= today);
  const incomes = recent.filter((o) => o.kind === 'rentree' && !o.debtId);
  const sum = (xs: Operation[]) => xs.reduce((s, o) => s + o.amount, 0);
  const main = incomes.filter((o) => o.incomeType !== 'petite');
  const small = incomes.filter((o) => o.incomeType === 'petite');
  const inCycle = (o: Operation) => o.date >= cycleStart && o.date <= today;

  const cycleSpends: CashFlow[] = ops.filter(inCycle).flatMap((o) => {
    if (o.kind === 'sortie' && !o.debtId) return [{ date: o.date, amount: o.amount + (o.fee ?? 0) }];
    if (o.kind === 'transfert' && o.fee) return [{ date: o.date, amount: o.fee }];
    return [];
  });

  // Moyenne sur la période réellement couverte par l'historique (1 à 3 mois), pas toujours 3 mois.
  const first = recent.reduce<CivilDate | null>((m, o) => (m === null || o.date < m ? o.date : m), null);
  const months = first ? Math.min(3, Math.max(1, Math.ceil((diffDays(first, today) + 1) / 30.4375))) : 1;
  return {
    mainMonthly: Math.round(sum(main) / months),
    smallMonthly: Math.round(sum(small) / months),
    cycleSpends,
    cycleSmallIncomes: small.filter(inCycle).map((o) => ({ date: o.date, amount: o.amount })),
    cycleMain: sum(main.filter(inCycle)),
  };
}
