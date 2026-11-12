import type { CategoryCap, Certainty, CivilDate, CycleSettings, OccurrenceOverride, DebtDirection, Francs, PlannedItem, Snapshot, WalletKind } from '@/domain';

export interface NewWallet {
  name: string;
  kind: WalletKind;
  everyday: boolean;
  openingBalance: Francs;
}

export type NewPlanned = Omit<PlannedItem, 'id'>;

export interface NewOperation {
  /** Clé stable de l'intention d'écriture : la même clé ne crée jamais deux opérations. */
  clientKey: string;
  kind: 'sortie' | 'rentree' | 'transfert';
  walletId: string;
  toWalletId?: string;
  amount: Francs;
  fee?: Francs;
  date: CivilDate;
  label: string;
  category?: string;
  plannedItemId?: string;
  incomeType?: 'principal' | 'petite';
}

export interface NewDebt {
  direction: DebtDirection;
  person: string;
  initial: Francs;
  dueDate?: CivilDate;
  walletId?: string;
  certainty?: Certainty;
}

export interface NewGoal {
  name: string;
  target: Francs;
  date: CivilDate;
  pocketWalletId: string;
  fromWalletId?: string;
  plannedDay: number;
}

export interface DebtPaymentInput {
  clientKey: string;
  debtId: string;
  amount: Francs;
  walletId: string;
  date: CivilDate;
}

export interface GoalMovementInput {
  clientKey: string;
  goalId: string;
  walletId: string;
  amount: Francs;
  date: CivilDate;
  withdraw: boolean;
}

export interface NewIntent {
  clientKey: string;
  amount: Francs;
  category: string;
  walletId: string;
  date: CivilDate;
  status: 'en_pause' | 'abandonne' | 'replanifie';
  remindOn?: CivilDate;
}

/** Erreur réseau : le serveur ne répond pas, la connexion est requise. */
export class ConnectionRequiredError extends Error {
  constructor(cause?: unknown) {
    super('Connexion requise');
    this.cause = cause;
  }
}

/** Écriture refusée par une règle métier (ex. paiement supérieur au reste) : message affichable. */
export class RefusedError extends Error {}

export interface FinanceRepository {
  readonly mode: 'demo' | 'compte';
  loadSnapshot(today: CivilDate): Promise<Snapshot>;
  addWallet(w: NewWallet): Promise<void>;
  addPlanned(p: NewPlanned): Promise<void>;
  recordOperation(op: NewOperation): Promise<void>;
  saveIntent(i: NewIntent): Promise<void>;
  addDebt(d: NewDebt): Promise<void>;
  /** Remboursement atomique : une opération + un règlement ; refuse un montant supérieur au reste. */
  payDebt(p: DebtPaymentInput): Promise<void>;
  cancelDebtPayment(paymentId: string): Promise<void>;
  setDebtStatus(debtId: string, status: 'annulee' | 'remise'): Promise<void>;
  addGoal(g: NewGoal): Promise<void>;
  /** Versement ou retrait réel : transfert atomique entre le quotidien et la poche d'épargne. */
  moveGoal(m: GoalMovementInput): Promise<void>;
  saveCycle(c: CycleSettings): Promise<void>;
  /** Crée ou met à jour le plafond d'une catégorie. */
  setCategoryCap(c: CategoryCap): Promise<void>;
  removeCategoryCap(category: string): Promise<void>;
  /** Achat en pause : reprise (replanifié à une date), achat effectué ou abandon. */
  updateIntent(id: string, status: 'achete' | 'abandonne' | 'replanifie' | 'en_pause', date?: CivilDate): Promise<void>;
  updateOperation(id: string, patch: OperationPatch): Promise<void>;
  deleteOperation(id: string): Promise<void>;
  addRecurring(r: NewRecurring): Promise<void>;
  /** Marque une occurrence payée (ou reçue) : une seule opération par occurrence. */
  settleOccurrence(s: SettleInput): Promise<void>;
  /** Modifie une seule occurrence (null = retire l'exception). */
  setOccurrence(ruleId: string, original: CivilDate, o: OccurrenceOverride | null): Promise<void>;
  /** Modifie cette occurrence et les suivantes. */
  splitRecurring(ruleId: string, fromOriginal: CivilDate, p: { amount: Francs; day: number; label: string; walletId: string }): Promise<void>;
  /** Arrête la dépense mensuelle après une date (dernière occurrence incluse). */
  stopRecurring(ruleId: string, end: CivilDate): Promise<void>;
}

export interface NewRecurring {
  label: string;
  kind: 'sortie' | 'rentree';
  amount: Francs;
  day: number;
  start: CivilDate;
  walletId: string;
  category?: string;
}

export interface SettleInput {
  clientKey: string;
  ruleId: string;
  original: CivilDate;
  amount: Francs;
  walletId: string;
  date: CivilDate;
}

export interface OperationPatch {
  amount: Francs;
  date: CivilDate;
  label: string;
  category?: string;
  walletId: string;
}
