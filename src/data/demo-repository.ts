import { addDays, type CivilDate, type PlannedItem, type Wallet } from '@/domain';

import type { FinanceRepository, NewIntent, NewOperation, NewPlanned, NewWallet } from './repository';

/**
 * Parcours de découverte : données fictives en mémoire, jamais envoyées au serveur
 * ni mélangées aux données personnelles. Applique la même idempotence que le serveur.
 */
export class DemoRepository implements FinanceRepository {
  readonly mode = 'demo' as const;
  private wallets: Wallet[] = [];
  private planned: PlannedItem[] = [];
  private keys = new Set<string>();
  intents: NewIntent[] = [];
  private seq = 0;

  constructor(today: CivilDate, seed = true) {
    if (!seed) return;
    this.wallets = [
      { id: 'demo-wave', name: 'Wave', kind: 'wave', everyday: true, balance: 30_000 },
      { id: 'demo-om', name: 'Orange Money', kind: 'orange_money', everyday: true, balance: 4_500 },
      { id: 'demo-ep', name: 'Épargne', kind: 'epargne', everyday: false, balance: 15_000 },
    ];
    this.planned = [
      { id: 'demo-loyer', kind: 'sortie', label: 'Loyer', amount: 25_000, date: addDays(today, 1), walletId: 'demo-wave', category: 'Logement', source: 'facture' },
      { id: 'demo-sal', kind: 'rentree', label: 'Paiement client', amount: 20_000, date: addDays(today, 4), walletId: 'demo-wave', certainty: 'attendue', source: 'revenu' },
      { id: 'demo-vers', kind: 'transfert', label: 'Versement épargne', amount: 10_000, date: addDays(today, 5), walletId: 'demo-wave', toWalletId: 'demo-ep', source: 'epargne' },
    ];
  }

  private id() {
    return `demo-${++this.seq}`;
  }

  async loadSnapshot(today: CivilDate) {
    return { today, wallets: this.wallets.map((w) => ({ ...w })), planned: this.planned.map((p) => ({ ...p })) };
  }

  async addWallet(w: NewWallet) {
    this.wallets.push({ id: this.id(), name: w.name, kind: w.kind, everyday: w.everyday, balance: w.openingBalance });
  }

  async addPlanned(p: NewPlanned) {
    this.planned.push({ ...p, id: this.id() });
  }

  async recordOperation(op: NewOperation) {
    if (this.keys.has(op.clientKey)) return;
    this.keys.add(op.clientKey);
    const w = this.wallets.find((x) => x.id === op.walletId);
    if (!w) throw new Error('Portefeuille inconnu');
    if (op.kind === 'rentree') w.balance += op.amount;
    else {
      w.balance -= op.amount + (op.fee ?? 0);
      if (op.kind === 'transfert') this.wallets.find((x) => x.id === op.toWalletId)!.balance += op.amount;
    }
    if (op.plannedItemId) {
      const p = this.planned.find((x) => x.id === op.plannedItemId);
      if (p) {
        if (op.amount >= p.amount) this.planned = this.planned.filter((x) => x !== p);
        else p.amount -= op.amount;
      }
    }
  }

  async saveIntent(i: NewIntent) {
    if (!this.intents.some((x) => x.clientKey === i.clientKey)) this.intents.push(i);
  }
}
