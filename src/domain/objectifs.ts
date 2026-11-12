import { addDays, type CivilDate, monthlyDate } from './dates';
import type { Francs } from './money';
import type { PlannedItem } from './types';

export interface GoalMovement {
  id: string;
  /** Positif : versement réel vers la poche ; négatif : retrait. */
  amount: Francs;
  date: CivilDate;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: Francs;
  date: CivilDate;
  /** Poche d'épargne (portefeuille non quotidien) qui reçoit les versements. */
  pocketWalletId: string;
  /** Portefeuille du quotidien d'où partent les versements prévus. */
  fromWalletId?: string;
  /** Jour du mois des versements prévus (ramené au dernier jour si absent). */
  plannedDay: number;
  status: 'actif' | 'atteint' | 'abandonne';
  movements: GoalMovement[];
}

export function progressOf(g: SavingsGoal): Francs {
  return Math.max(0, g.movements.reduce((s, m) => s + m.amount, 0));
}

export function goalRemaining(g: SavingsGoal): Francs {
  return Math.max(0, g.target - progressOf(g));
}

export interface Installment {
  date: CivilDate;
  amount: Francs;
}

export interface GoalSchedule {
  installments: Installment[];
  perInstallment: Francs;
  /** Nouvelle date proposée si l'échéance est passée ou si la capacité ne suffit pas. */
  suggestedDate: CivilDate | null;
}

function nextMonthly(from: CivilDate, day: number): CivilDate {
  let [y, m] = from.split('-').map(Number);
  let d = monthlyDate(y, m, day);
  if (d < from) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    d = monthlyDate(y, m, day);
  }
  return d;
}

function monthlyDatesBetween(from: CivilDate, to: CivilDate, day: number): CivilDate[] {
  const out: CivilDate[] = [];
  for (let d = nextMonthly(from, day); d <= to; d = nextMonthly(addDays(d, 1), day)) out.push(d);
  return out;
}

/**
 * Échéancier ajusté : le reste est réparti sur les dates de versement disponibles jusqu'à l'échéance,
 * arrondi au franc supérieur (la dernière échéance absorbe l'arrondi).
 * `capacity` : montant disponible par mois ; s'il ne suffit pas, une date réaliste est proposée.
 */
export function goalSchedule(g: SavingsGoal, today: CivilDate, capacity?: Francs): GoalSchedule {
  const remaining = goalRemaining(g);
  if (remaining === 0 || g.status !== 'actif') return { installments: [], perInstallment: 0, suggestedDate: null };

  const dates = monthlyDatesBetween(today, g.date, g.plannedDay);
  const per = dates.length ? Math.ceil(remaining / dates.length) : remaining;
  const tooHigh = capacity !== undefined && capacity > 0 && per > capacity;

  if (dates.length === 0 || tooHigh) {
    const monthly = tooHigh ? capacity! : per;
    const n = Math.ceil(remaining / Math.max(1, monthly));
    const plan: Installment[] = [];
    let d = nextMonthly(today, g.plannedDay);
    for (let i = 0; i < n; i++) {
      plan.push({ date: d, amount: i === n - 1 ? remaining - monthly * (n - 1) : monthly });
      d = nextMonthly(addDays(d, 1), g.plannedDay);
    }
    return { installments: plan, perInstallment: monthly, suggestedDate: plan.at(-1)!.date };
  }

  return {
    installments: dates.map((date, i) => ({ date, amount: i === dates.length - 1 ? remaining - per * (dates.length - 1) : per })),
    perInstallment: per,
    suggestedDate: null,
  };
}

/** Versements prévus des objectifs actifs → transferts prévus du quotidien vers la poche d'épargne. */
export function goalsToPlanned(goals: SavingsGoal[], today: CivilDate): PlannedItem[] {
  return goals
    .filter((g) => g.status === 'actif' && g.fromWalletId)
    .flatMap((g) =>
      goalSchedule(g, today).installments.map((it, i): PlannedItem => ({
        id: `objectif-${g.id}-${i}`, kind: 'transfert', label: `Épargne : ${g.name}`, amount: it.amount, date: it.date,
        walletId: g.fromWalletId!, toWalletId: g.pocketWalletId, source: 'epargne',
      })),
    );
}
