import {
  addDays, checkPayment, progressOf, statusAfterPayments,
  type CategoryCap, type CivilDate, type CycleSettings, type IntentRecord, type LoanRecord, type OccurrenceOverride, type RecurringRule, type Debt, type Operation, type PlannedItem, type SavingsGoal, type Wallet,
} from '@/domain';

import {
  RefusedError, type DebtPaymentInput, type FinanceRepository, type GoalMovementInput, type NewDebt, type NewGoal,
  type LoanOperationInput, type NewIntent, type NewLoan, type NewOperation, type NewRecurring, type OperationPatch, type SettleInput, type NewPlanned, type NewWallet,
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
  private intents: IntentRecord[] = [];
  private intentKeys = new Set<string>();
  private cycle: CycleSettings = { startDay: 1 };
  private caps: CategoryCap[] = [];
  private today: CivilDate;
  private rules: RecurringRule[] = [];
  private loans: LoanRecord[] = [];
  private seq = 0;

  constructor(today: CivilDate, seed = true) {
    this.today = today;
    if (!seed) return;
    this.caps = [
      { category: 'Sorties', cap: 25_000, pleasure: true },
      { category: 'Alimentation', cap: 45_000, pleasure: false },
      { category: 'Transport', cap: 20_000, pleasure: false },
    ];
    this.wallets = [
      { id: 'demo-wave', name: 'Wave', kind: 'wave', everyday: true, balance: 30_000 },
      { id: 'demo-om', name: 'Orange Money', kind: 'orange_money', everyday: true, balance: 4_500 },
      { id: 'demo-esp', name: 'Espèces', kind: 'especes', everyday: true, balance: 6_000 },
      { id: 'demo-ep', name: 'Épargne', kind: 'epargne', everyday: false, balance: 15_000 },
    ];
    this.planned = [
      { id: 'demo-sal', kind: 'rentree', label: 'Salaire', amount: 120_000, date: addDays(today, 18), walletId: 'demo-wave', certainty: 'attendue', source: 'revenu' },
    ];
    // Historique fictif du mois : salaire + nombreuses petites sommes reçues et dépensées.
    const start = `${today.slice(0, 8)}01`;
    const day = (n: number) => { const d = addDays(start, n); return d > today ? today : d; };
    this.ops.push({ id: this.id(), kind: 'rentree', walletId: 'demo-wave', amount: 120_000, date: start, label: 'Salaire', incomeType: 'principal' });
    [5_000, 2_000, 10_000, 3_000, 5_000, 7_500, 2_500, 5_000].forEach((a, i) =>
      this.ops.push({ id: this.id(), kind: 'rentree', walletId: 'demo-esp', amount: a, date: day(i + 1), label: 'Petite somme', incomeType: 'petite' }));
    const cats = ['Alimentation', 'Transport', 'Sorties', 'Alimentation', 'Sorties', 'Transport'];
    [3_000, 1_500, 12_000, 2_000, 6_500, 4_000, 15_000, 2_500, 8_000, 3_500, 25_000, 1_000].forEach((a, i) =>
      this.ops.push({ id: this.id(), kind: 'sortie', walletId: 'demo-esp', amount: a, date: day(i), label: cats[i % 6], category: cats[i % 6] }));
    this.intents.push({ id: this.id(), amount: 18_000, category: 'Habillement', walletId: 'demo-wave', date: addDays(today, 1), status: 'en_pause', createdOn: today });
    // Dépenses obligatoires de chaque mois (montants fictifs, ordres de grandeur d'Abidjan).
    const rule = (id: string, label: string, amount: number, day: number, category: string): RecurringRule => ({
      id, label, kind: 'sortie', amount, day, start: today, walletId: 'demo-wave', category, overrides: {}, settled: [],
    });
    this.rules = [
      rule('demo-loyer', 'Loyer', 25_000, Number(addDays(today, 1).slice(8)), 'Logement'),
      rule('demo-cie', 'Électricité (CIE)', 12_000, 20, 'Logement'),
      rule('demo-sodeci', 'Eau (SODECI)', 6_000, 20, 'Logement'),
      rule('demo-internet', 'Internet', 15_000, 5, 'Logement'),
      rule('demo-tontine', 'Tontine', 10_000, 28, 'Famille'),
    ];
    // Crédit fictif : prêt microfinance de 300 000 F sur 10 mois à 22 %.
    this.loans = [{
      id: 'demo-pret', label: 'Prêt microfinance', lenderType: 'microfinance', principal: 300_000, annualRate: 0.22, months: 10,
      firstDueDate: addDays(today, 8), method: 'annuite', fees: 6_000, insuranceMonthly: 500, walletId: 'demo-wave',
      paid: [], extras: [], status: 'en_cours', disbursed: true,
    }];
    this.debts = [
      { id: 'demo-dette', direction: 'je_dois', person: 'Koffi', initial: 20_000, dueDate: addDays(today, 10), walletId: 'demo-wave', status: 'ouverte', payments: [] },
      { id: 'demo-creance', direction: 'on_me_doit', person: 'Awa', initial: 15_000, status: 'ouverte', certainty: 'incertaine', payments: [] },
    ];
    this.goals = [{
      id: 'demo-fonds', name: 'Fonds d’urgence', target: 255_000, date: addDays(today, 365), pocketWalletId: 'demo-ep',
      fromWalletId: 'demo-wave', plannedDay: 28, status: 'actif', movements: [{ id: 'demo-m0', amount: 15_000, date: addDays(start, -5) }],
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
      categories: this.caps.map((c) => ({ ...c })),
      intents: this.intents.map((i) => ({ ...i })),
      cycle: { ...this.cycle },
      loans: this.loans.map((l) => ({ ...l, paid: [...l.paid], extras: [...l.extras] })),
      recurring: this.rules.map((r) => ({ ...r, overrides: { ...r.overrides }, settled: [...r.settled] })),
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
    if (this.intentKeys.has(i.clientKey)) return;
    this.intentKeys.add(i.clientKey);
    this.intents.unshift({ id: this.id(), amount: i.amount, category: i.category, walletId: i.walletId, date: i.date, status: i.status, createdOn: this.today });
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

  async saveCycle(c: CycleSettings) {
    this.cycle = { ...c };
  }

  async setCategoryCap(c: CategoryCap) {
    this.caps = [...this.caps.filter((x) => x.category !== c.category), c].sort((a, b) => a.category.localeCompare(b.category));
  }

  async removeCategoryCap(category: string) {
    this.caps = this.caps.filter((x) => x.category !== category);
  }

  async updateIntent(id: string, status: IntentRecord['status'], date?: CivilDate) {
    const i = this.intents.find((x) => x.id === id);
    if (i) Object.assign(i, { status }, date ? { date } : {});
  }

  private editable(id: string) {
    const o = this.ops.find((x) => x.id === id);
    if (!o) throw new RefusedError('Opération introuvable');
    if (o.debtId) throw new RefusedError('Annulez ce remboursement depuis la dette.');
    return o;
  }

  async updateOperation(id: string, p: OperationPatch) {
    const o = this.editable(id);
    if (o.goalId) throw new RefusedError('Opération liée : corrigez-la depuis son objectif.');
    this.unapply(id);
    this.apply({ ...o, amount: p.amount, date: p.date, label: p.label, category: p.category, walletId: p.walletId });
  }

  async deleteOperation(id: string) {
    const o = this.editable(id);
    if (o.goalId) {
      const g = this.goals.find((x) => x.id === o.goalId)!;
      const left = g.movements.filter((m) => m.id !== id).reduce((s, m) => s + m.amount, 0);
      if (left < 0) throw new RefusedError('Suppression impossible : l’épargne deviendrait négative.');
      g.movements = g.movements.filter((m) => m.id !== id);
    }
    if (o.loanId) {
      // Annuler une opération de crédit la retire de l'échéancier (elle redevient due).
      const l = this.loans.find((y) => y.id === o.loanId);
      if (l && o.loanInstallment === 0) l.disbursed = false;
      else if (l && o.loanInstallment === null) l.extras = l.extras.filter((e) => !(e.date === o.date && e.amount === o.amount));
      else if (l) l.paid = l.paid.filter((n) => n !== o.loanInstallment);
    }
    if (o.recurring) {
      const r = this.rules.find((y) => y.id === o.recurring!.ruleId);
      if (r) r.settled = r.settled.filter((d) => d !== o.recurring!.original);
    }
    this.unapply(id);
  }

  async addRecurring(r: NewRecurring) {
    this.rules.push({ ...r, id: this.id(), overrides: {}, settled: [] });
  }

  async settleOccurrence(x: SettleInput) {
    if (this.seen(x.clientKey)) return;
    const r = this.rules.find((y) => y.id === x.ruleId);
    if (!r) throw new RefusedError('Dépense mensuelle introuvable');
    if (r.settled.includes(x.original)) throw new RefusedError('Cette échéance est déjà réglée.');
    this.apply({
      id: `op-${x.clientKey}`, kind: r.kind, walletId: x.walletId, amount: x.amount, date: x.date, label: r.label, category: r.category,
      incomeType: r.kind === 'rentree' ? 'principal' : undefined, recurring: { ruleId: r.id, original: x.original },
    });
    r.settled.push(x.original);
  }

  async setOccurrence(ruleId: string, original: CivilDate, o: OccurrenceOverride | null) {
    const r = this.rules.find((y) => y.id === ruleId);
    if (!r) return;
    if (o) r.overrides[original] = o;
    else delete r.overrides[original];
  }

  async splitRecurring(ruleId: string, fromOriginal: CivilDate, p: { amount: number; day: number; label: string; walletId: string }) {
    const r = this.rules.find((y) => y.id === ruleId);
    if (!r) return;
    if (fromOriginal <= r.start) return void Object.assign(r, p);
    this.rules.push({ ...r, ...p, id: this.id(), start: fromOriginal, overrides: {}, settled: [] });
    r.end = addDays(fromOriginal, -1);
  }

  async stopRecurring(ruleId: string, end: CivilDate) {
    const r = this.rules.find((y) => y.id === ruleId);
    if (r) r.end = end;
  }

  async reschedulePlanned(id: string, date: CivilDate) {
    const p = this.planned.find((x) => x.id === id);
    if (p) p.date = date;
  }

  async deleteAccount() {
    throw new RefusedError('La découverte n’a pas de compte : quittez-la simplement.');
  }

  async addLoan(l: NewLoan) {
    if (!this.wallets.find((w) => w.id === l.walletId)?.everyday) throw new RefusedError('Choisissez un portefeuille du quotidien.');
    const id = this.id();
    this.loans.push({ ...l, id, paid: [], extras: [], status: 'en_cours', disbursed: false });
    return id;
  }

  async recordLoanOperation(o: LoanOperationInput) {
    if (this.seen(o.clientKey)) return;
    const l = this.loans.find((x) => x.id === o.loanId);
    if (!l) throw new RefusedError('Crédit introuvable');
    if (o.installment === 0 && (l.disbursed || o.amount !== l.principal - l.fees))
      throw new RefusedError(`Le déblocage correspond au montant emprunté moins les frais (${l.principal - l.fees} F).`);
    if (o.installment && l.paid.includes(o.installment)) throw new RefusedError('Cette échéance est déjà enregistrée.');
    this.apply({
      id: `op-${o.clientKey}`, kind: o.installment === 0 ? 'rentree' : 'sortie', walletId: o.walletId, amount: o.amount, date: o.date,
      label: `${o.installment === 0 ? 'Déblocage' : o.installment === null ? 'Remboursement anticipé' : 'Échéance'} : ${l.label}`,
      category: 'Crédit', loanId: l.id, loanInstallment: o.installment,
    });
    if (o.installment === 0) l.disbursed = true;
    else if (o.installment === null) l.extras.push({ date: o.date, amount: o.amount });
    else l.paid.push(o.installment);
  }

  async setLoanStatus(id: string, status: 'en_cours' | 'solde') {
    const l = this.loans.find((x) => x.id === id);
    if (l) l.status = status;
  }
}
