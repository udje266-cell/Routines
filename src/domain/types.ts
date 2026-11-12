import type { CivilDate } from './dates';
import type { CategoryCap, CycleSettings, IntentRecord } from './cycle';
import type { LoanRecord } from './credit';
import type { Debt } from './dettes';
import type { Francs } from './money';
import type { SavingsGoal } from './objectifs';
import type { RecurringRule } from './recurrence';
import type { Operation } from './revenus';

export type WalletKind = 'especes' | 'wave' | 'orange_money' | 'banque' | 'epargne';

export interface Wallet {
  id: string;
  name: string;
  kind: WalletKind;
  /** Portefeuille du quotidien : compte dans le total disponible. */
  everyday: boolean;
  /** Solde réel (opérations confirmées uniquement). */
  balance: Francs;
}

/** Certitude d'une rentrée prévue. */
export type Certainty = 'attendue' | 'incertaine';

export type PlannedKind = 'sortie' | 'rentree' | 'transfert';

/** Échéance non encore réglée : seule la partie prévue, jamais le réel. */
export interface PlannedItem {
  id: string;
  kind: PlannedKind;
  label: string;
  amount: Francs;
  date: CivilDate;
  walletId: string;
  /** Transfert : portefeuille de destination (ex. épargne). */
  toWalletId?: string;
  /** Rentrée : 'attendue' (vue standard) ou 'incertaine' (écartée). */
  certainty?: Certainty;
  /** Sortie explicitement financée par cette rentrée du même jour (vue standard). */
  fundedByIncomeId?: string;
  category?: string;
  /** Origine métier, pour l'affichage (loyer, dette, épargne…). */
  source?: 'facture' | 'dette' | 'epargne' | 'revenu' | 'achat';
  /** Occurrence d'une dépense mensuelle (pour la marquer payée ou la modifier). */
  recurring?: { ruleId: string; original: CivilDate };
  /** Échéance d'un crédit. */
  loan?: { loanId: string; n: number };
}

export type ForecastView = 'standard' | 'prudente';

export interface CategoryBudget {
  category: string;
  cap: Francs;
  spent: Francs;
}

export interface UndatedDebt {
  id: string;
  person: string;
  remaining: Francs;
}

export interface Snapshot {
  today: CivilDate;
  wallets: Wallet[];
  planned: PlannedItem[];
  budgets?: CategoryBudget[];
  undatedDebts?: UndatedDebt[];
  /** Historique réel récent. */
  operations?: Operation[];
  debts?: Debt[];
  goals?: SavingsGoal[];
  categories?: CategoryCap[];
  intents?: IntentRecord[];
  cycle?: CycleSettings;
  recurring?: RecurringRule[];
  loans?: LoanRecord[];
}
