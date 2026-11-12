import type { CivilDate, Francs, PlannedItem, Snapshot, WalletKind } from '@/domain';

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

export interface FinanceRepository {
  readonly mode: 'demo' | 'compte';
  loadSnapshot(today: CivilDate): Promise<Snapshot>;
  addWallet(w: NewWallet): Promise<void>;
  addPlanned(p: NewPlanned): Promise<void>;
  recordOperation(op: NewOperation): Promise<void>;
  saveIntent(i: NewIntent): Promise<void>;
}
