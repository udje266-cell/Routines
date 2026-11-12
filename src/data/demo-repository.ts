import {
  addDays, checkPayment, progressOf, statusAfterPayments,
  type CivilDate, type Debt, type Operation, type PlannedItem, type SavingsGoal, type Wallet,
} from '@/domain';

import {
  RefusedError, type DebtPaymentInput, type FinanceRepository, type GoalMovementInput, type NewDebt, type NewGoal,
  type NewIntent, type NewOperation, type NewPlanned, type NewWallet,
} from './repository';

/**
 * Parcours de découverte : données fictives en mémoire, jamais envoyées au serveur ni mélangées
 * aux données personnelles. Applique les mêmes règles que les fonctions serveur (idempotence, reste dû…).
 */
export class DemoRepository implements FinanceRepository {
  readonly mode = 'demo' as const;
  private wallets: Wallet[] = [];
  private planned: PlannedItem[] = [];
  private ops: Operation[] = [];
  private debts: Debt[] = [];
  private goals: SavingsGoal[] = [];
  private paymentOps = new Map<string, string>(); // règlement → opération
  intents: NewIntent[] = [];
  private seq = 0;

  constructor(today: CivilDate, seed = true) {
    if (!seed) return;
    this.wallets = [
      { id: 'demo-wave', name: 'Wave', kind: 'wave', everyday: true, balance: 30_000 },
      { id: 'demo-om', name: 'Orange Money', kind: 'orange_money', everyday: true, balance: 4_500 },
      { id: 'demo-esp', name: 'Espèces', kind: 'especes', everyday: true, balance: 6_000 },
      { id: 'demo-ep', name: 'Épargne', kind: 'epargne', everyday: false, balance: 15_000 },
    ];
    this.planned = [
      { id: 'demo-loyer', kind: 'sortie', label: 'Loyer', amount: 25_000, date: addDays(today, 1), walletId: 'demo-wave', category: 'Logement', source: 'facture' },
      { id: 'demo-sal', kind: 'rentree', label: 'Salaire', amount: 120_000, date: addDays(today, 18), walletId: 'demo-wave', certainty: 'attendue', source: 'revenu' },
    ];
    // Historique fictif du mois : salaire + nombreuses petites sommes reçues et dépensées.
    const start = `${today.slice(0, 8)}01`;
    const day = (n: number) => { const d = addDays(start, n); return d > today ? today : d; };
    this.ops.push({ id: this.id(), kind: 'rentree', walletId: 'demo-wave', amount: 120_000, date: start, label: 'Salaire', incomeType: 'principal' });
    [5_000, 2_000, 10_000, 3_000, 5_000, 7_500, 2_500, 5_000].forEach((a, i) =>
      this.ops.push({ id: this.id(), kind: 'rentree', walletId: 'demo-esp', amount: a, date: day(i + 1), label: 'Petite somme', incomeType: 'petite' }));
    [3_000, 1_500, 12_000, 2_000, 6_500, 4_000, 15_000, 2_500, 8_000, 3_500, 25_000, 1_000].forEach((a, i) =>
      this.ops.push({ id: this.id(), kind: 'sortie', walletId: 'demo-esp', amount: a, date: day(i), label: 'Dépense', category: 'Quotidien' }));
    this.debts = [
      { id: 'demo-dette', direction: 'je_dois', person: 'Koffi', initial: 20_000, dueDate: addDays(today, 10), walletId: 'demo-wave', status: 'ouverte', payments: [] },
      { id: 'demo-creance', direction: 'on_me_doit', person: 'Awa', initial: 15_000, status: 'ouverte', certainty: 'incertaine', payments: [] },
    ];
    this.goals = [{
      id: 'demo-fonds', name: 'Fonds d’urgence', target: 255_000, date: addDays(today, 365), pocketWalletId: 'demo-ep',
      fromWalletId: 'demo-wave', plannedDay: 28, status: 'actif', movements: [{ id: 'demo-m0', amount: 15_000, date: start }],
    }];
  }

  private id() {
    return `demo-${++this.seq}`;
  }

  private seen(key: string) {
    return this.ops.some((o) => o.id === `op-${key}`);
  }

  private apply(o: Operation) {
    const w = (id?: string) => this.wallets.find((x) => x.id === id);
    if (o.kind === 'rentree') w(o.walletId)!.balance += o.amount;
    else {
      w(o.walletId)!.balance -= o.amount + (o.fee ?? 0);
      if (o.kind === 'transfert') w(o.toWalletId)!.balance += o.amount;
    }
    this.ops.push(o);
  }

  private unapply(opId: string) {
    const o = this.ops.find((x) => x.id === opId);
    if (!o) return;
    const w = (id?: string) => this.wallets.find((x) => x.id === id)!;
    if (o.kind === 'rentree') w(o.walletId).balance -= o.amount;
    else w(o.walletId).balance += o.amount + (o.fee ?? 0);
    this.ops = this.ops.filter((x) => x !== o);
  }

  async loadSnapshot(today: CivilDate) {
    return {
      today,
      wallets: this.wallets.map((w) => ({ ...w })),
      planned: this.planned.map((p) => ({ ...p })),
      operations: this.ops.map((o) => ({ ...o })),
      debts: this.debts.map((d) => ({ ...d, payments: [...d.payments] })),
      goals: this.goals.map((g) => ({ ...g, movements: [...g.movements] })),
    };
  }

  async addWallet(w: NewWallet) {
    this.wallets.push({ id: this.id(), name: w.name, kind: w.kind, everyday: w.everyday, balance: w.openingBalance });
  }

  async addPlanned(p: NewPlanned) {
    this.planned.push({ ...p, id: this.id() });
  }

  async recordOperation(op: NewOperation) {
    if (this.seen(op.clientKey)) return;
    if (!this.wallets.some((x) => x.id === op.walletId)) throw new RefusedError('Portefeuille inconnu');
    this.apply({
      id: `op-${op.clientKey}`, kind: op.kind, walletId: op.walletId, toWalletId: op.toWalletId, amount: op.amount, fee: op.fee,
      date: op.date, label: op.label, category: op.category, incomeType: op.kind === 'rentree' ? op.incomeType ?? 'principal' : undefined,
    });
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

  async addDebt(d: NewDebt) {
    this.debts.push({
      id: this.id(), direction: d.direction, person: d.person, initial: d.initial, dueDate: d.dueDate, walletId: d.walletId,
      certainty: d.direction === 'on_me_doit' ? d.certainty ?? 'incertaine' : undefined, status: 'ouverte', payments: [],
    });
  }

  async payDebt(p: DebtPaymentInput) {
    if (this.seen(p.clientKey)) return;
    const d = this.debts.find((x) => x.id === p.debtId);
    if (!d) throw new RefusedError('Dette introuvable');
    const err = checkPayment(d, p.amount);
    if (err) throw new RefusedError(err);
    const opId = `op-${p.clientKey}`;
    this.apply({
      id: opId, kind: d.direction === 'je_dois' ? 'sortie' : 'rentree', walletId: p.walletId, amount: p.amount, date: p.date,
      label: d.direction === 'je_dois' ? `Remboursement à ${d.person}` : `Remboursement de ${d.person}`, debtId: d.id,
    });
    const payId = this.id();
    this.paymentOps.set(payId, opId);
    d.payments.push({ id: payId, amount: p.amount, date: p.date });
    d.status = statusAfterPayments(d);
  }

  async cancelDebtPayment(paymentId: string) {
    const d = this.debts.find((x) => x.payments.some((p) => p.id === paymentId));
    if (!d) throw new RefusedError('Règlement introuvable');
    this.unapply(this.paymentOps.get(paymentId)!);
    d.payments = d.payments.filter((p) => p.id !== paymentId);
    d.status = statusAfterPayments(d);
  }

  async setDebtStatus(debtId: string, status: 'annulee' | 'remise') {
    const d = this.debts.find((x) => x.id === debtId);
    if (d) d.status = status;
  }

  async addGoal(g: NewGoal) {
    this.goals.push({ ...g, id: this.id(), status: 'actif', movements: [] });
  }

  async moveGoal(m: GoalMovementInput) {
    if (this.seen(m.clientKey)) return;
    const g = this.goals.find((x) => x.id === m.goalId);
    if (!g) throw new RefusedError('Objectif introuvable');
    if (m.withdraw && m.amount > progressOf(g)) throw new RefusedError(`Retrait supérieur à l’épargne (${progressOf(g)} F)`);
    this.apply({
      id: `op-${m.clientKey}`, kind: 'transfert', amount: m.amount, date: m.date, goalId: g.id,
      walletId: m.withdraw ? g.pocketWalletId : m.walletId, toWalletId: m.withdraw ? m.walletId : g.pocketWalletId,
      label: `${m.withdraw ? 'Retrait' : 'Épargne'} : ${g.name}`,
    });
    g.movements.push({ id: `op-${m.clientKey}`, amount: m.withdraw ? -m.amount : m.amount, date: m.date });
  }
}
