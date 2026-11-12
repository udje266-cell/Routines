import type { CivilDate } from './dates';
import type { Francs } from './money';
import type { Certainty, PlannedItem, UndatedDebt } from './types';

export type DebtDirection = 'je_dois' | 'on_me_doit';
/** « reglee » = remboursée en totalité ; « annulee » = saisie par erreur ; « remise » = effacée par accord. */
export type DebtStatus = 'ouverte' | 'reglee' | 'annulee' | 'remise';

export interface DebtPayment {
  id: string;
  amount: Francs;
  date: CivilDate;
}

export interface Debt {
  id: string;
  direction: DebtDirection;
  person: string;
  initial: Francs;
  dueDate?: CivilDate;
  /** Portefeuille prévu pour le paiement ou l'encaissement. */
  walletId?: string;
  /** Créance : incertaine par défaut. */
  certainty?: Certainty;
  status: DebtStatus;
  payments: DebtPayment[];
}

export function paidOf(d: Debt): Francs {
  return d.payments.reduce((s, p) => s + p.amount, 0);
}

/** Reste dû : nul si la dette est annulée ou remise. */
export function remainingOf(d: Debt): Francs {
  if (d.status === 'annulee' || d.status === 'remise') return 0;
  return Math.max(0, d.initial - paidOf(d));
}

/** Vérifie un paiement partiel ; renvoie un message d'erreur ou null. */
export function checkPayment(d: Debt, amount: Francs): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 'Montant invalide.';
  if (d.status !== 'ouverte') return 'Cette dette est close.';
  const rest = remainingOf(d);
  if (amount > rest) return `Le paiement dépasse le reste dû (${rest} F).`;
  return null;
}

/** Statut recalculé après ajout ou annulation d'un paiement (annulée / remise restent inchangées). */
export function statusAfterPayments(d: Debt): DebtStatus {
  if (d.status === 'annulee' || d.status === 'remise') return d.status;
  return d.initial - paidOf(d) <= 0 ? 'reglee' : 'ouverte';
}

/** Dettes ouvertes et datées → échéances : je dois = sortie prévue, on me doit = rentrée (incertaine par défaut). */
export function debtsToPlanned(debts: Debt[]): PlannedItem[] {
  return debts
    .filter((d) => d.status === 'ouverte' && d.dueDate && d.walletId && remainingOf(d) > 0)
    .map((d) =>
      d.direction === 'je_dois'
        ? { id: `dette-${d.id}`, kind: 'sortie', label: `Rembourser ${d.person}`, amount: remainingOf(d), date: d.dueDate!, walletId: d.walletId!, source: 'dette' }
        : { id: `creance-${d.id}`, kind: 'rentree', label: `${d.person} me rembourse`, amount: remainingOf(d), date: d.dueDate!, walletId: d.walletId!, certainty: d.certainty ?? 'incertaine', source: 'dette' },
    );
}

/** Dettes à payer sans date : signalées par le simulateur. */
export function undatedDebtsOf(debts: Debt[]): UndatedDebt[] {
  return debts
    .filter((d) => d.direction === 'je_dois' && d.status === 'ouverte' && !d.dueDate && remainingOf(d) > 0)
    .map((d) => ({ id: d.id, person: d.person, remaining: remainingOf(d) }));
}
