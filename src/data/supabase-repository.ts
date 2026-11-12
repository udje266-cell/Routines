import type { SupabaseClient } from '@supabase/supabase-js';

import {
  addDays, type CategoryCap, type CivilDate, type CycleSettings, type Debt, type IntentRecord, type OccurrenceOverride, type Operation,
  type PlannedItem, type RecurringRule, type SavingsGoal, type Wallet,
} from '@/domain';

import {
  ConnectionRequiredError, RefusedError, type DebtPaymentInput, type FinanceRepository, type GoalMovementInput, type NewDebt,
  type NewGoal, type NewIntent, type NewOperation, type NewPlanned, type NewRecurring, type NewWallet, type OperationPatch, type SettleInput,
} from './repository';

// Lignes brutes de PostgREST, converties explicitement vers les types du domaine.
type Row = Record<string, any>;

function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return /network|fetch|timeout|Failed to fetch|Network request failed/i.test(msg);
}

async function run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  let res: { data: T; error: unknown };
  try {
    res = await p;
  } catch (e) {
    throw new ConnectionRequiredError(e);
  }
  if (res.error) {
    if (isNetworkError(res.error)) throw new ConnectionRequiredError(res.error);
    const err = res.error as { code?: string; message?: string };
    if (err.code === '22023' || err.code === 'P0002') throw new RefusedError(err.message ?? 'Refusé');
    throw res.error;
  }
  return res.data;
}

export class SupabaseRepository implements FinanceRepository {
  readonly mode = 'compte' as const;
  constructor(private db: SupabaseClient) {}

  async loadSnapshot(today: CivilDate) {
    const from = addDays(today, -120);
    const [wallets, balances, planned, ops, debts, goals, settings, caps, intents, rules] = await Promise.all([
      run(this.db.from('wallets').select('id,name,kind,everyday').order('created_at')),
      run(this.db.from('wallet_balances').select('wallet_id,balance')),
      run(this.db.from('planned_items').select('*').eq('status', 'prevue').order('due_date')),
      // historique récent + tous les mouvements d'objectifs (pour la progression)
      run(this.db.from('operations').select('*').or(`op_date.gte.${from},goal_id.not.is.null`).order('op_date')),
      run(this.db.from('debts').select('*, debt_payments(id, amount, paid_on)').order('created_at')),
      run(this.db.from('goals').select('*').order('created_at')),
      run(this.db.from('user_settings').select('*').maybeSingle()),
      run(this.db.from('category_caps').select('category,cap,pleasure').order('category')),
      run(this.db.from('purchase_intents').select('*').gte('created_on', from).order('created_at', { ascending: false })),
      run(this.db.from('recurring_rules').select('*, recurring_overrides(*)').order('day')),
    ]);
    const st = settings as Row | null;
    const operations = (ops as Row[]).map((o): Operation => ({
      id: o.id, kind: o.kind, walletId: o.wallet_id, toWalletId: o.to_wallet_id ?? undefined, amount: Number(o.amount),
      fee: Number(o.fee), date: o.op_date, label: o.label, category: o.category ?? undefined,
      incomeType: o.income_type ?? undefined, debtId: o.debt_id ?? undefined, goalId: o.goal_id ?? undefined,
      recurring: o.recurring_rule_id ? { ruleId: o.recurring_rule_id, original: o.recurring_original } : undefined,
    }));
    const bal = new Map((balances as { wallet_id: string; balance: number }[]).map((b) => [b.wallet_id, Number(b.balance)]));
    return {
      today,
      wallets: (wallets as Omit<Wallet, 'balance'>[]).map((w) => ({ ...w, balance: bal.get(w.id) ?? 0 })),
      planned: (planned as Record<string, never>[]).map(
        (p): PlannedItem => ({
          id: p.id, kind: p.kind, label: p.label, amount: Number(p.amount), date: p.due_date,
          walletId: p.wallet_id, toWalletId: p.to_wallet_id ?? undefined, certainty: p.certainty ?? undefined,
          fundedByIncomeId: p.funded_by_income_id ?? undefined, category: p.category ?? undefined, source: p.source ?? undefined,
        }),
      ),
      operations: operations.filter((o) => o.date >= from),
      cycle: {
        startDay: st?.cycle_start_day ?? 1, freeStart: st?.free_start ?? undefined, freeNextStart: st?.free_next_start ?? undefined,
      } satisfies CycleSettings,
      categories: (caps as Row[]).map((c): CategoryCap => ({ category: c.category, cap: Number(c.cap), pleasure: c.pleasure })),
      recurring: (rules as Row[]).map((r): RecurringRule => ({
        id: r.id, label: r.label, kind: r.kind, amount: Number(r.amount), day: r.day, start: r.start_date, end: r.end_date ?? undefined,
        walletId: r.wallet_id, category: r.category ?? undefined,
        overrides: Object.fromEntries((r.recurring_overrides as Row[]).map((o) => [o.original_date, {
          date: o.new_date ?? undefined, amount: o.new_amount ? Number(o.new_amount) : undefined, skip: o.skip,
        }])),
        settled: operations.filter((o) => o.recurring?.ruleId === r.id).map((o) => o.recurring!.original),
      })),
      intents: (intents as Row[]).map((i): IntentRecord => ({
        id: i.id, amount: Number(i.amount), category: i.category, walletId: i.wallet_id, date: i.planned_date, status: i.status, createdOn: i.created_on,
      })),
      debts: (debts as Row[]).map((d): Debt => ({
        id: d.id, direction: d.direction, person: d.person, initial: Number(d.initial_amount), dueDate: d.due_date ?? undefined,
        walletId: d.wallet_id ?? undefined, certainty: d.certainty ?? undefined, status: d.status,
        payments: (d.debt_payments as Row[]).map((p) => ({ id: p.id, amount: Number(p.amount), date: p.paid_on })),
      })),
      goals: (goals as Row[]).map((g): SavingsGoal => ({
        id: g.id, name: g.name, target: Number(g.target_amount), date: g.target_date, pocketWalletId: g.pocket_wallet_id,
        fromWalletId: g.from_wallet_id ?? undefined, plannedDay: g.planned_day, status: g.status,
        movements: operations.filter((o) => o.goalId === g.id).map((o) => ({
          id: o.id, date: o.date, amount: o.toWalletId === g.pocket_wallet_id ? o.amount : -o.amount,
        })),
      })),
    };
  }

  async addWallet(w: NewWallet) {
    await run(this.db.from('wallets').insert({ name: w.name, kind: w.kind, everyday: w.everyday, opening_balance: w.openingBalance }));
  }

  async addPlanned(p: NewPlanned) {
    await run(
      this.db.from('planned_items').insert({
        kind: p.kind, label: p.label, amount: p.amount, due_date: p.date, wallet_id: p.walletId,
        to_wallet_id: p.toWalletId ?? null, certainty: p.kind === 'rentree' ? p.certainty ?? 'attendue' : null,
        funded_by_income_id: p.fundedByIncomeId ?? null, category: p.category ?? null, source: p.source ?? null,
      }),
    );
  }

  async recordOperation(op: NewOperation) {
    await run(
      this.db.rpc('record_operation', {
        p_client_key: op.clientKey, p_kind: op.kind, p_wallet_id: op.walletId, p_amount: op.amount,
        p_op_date: op.date, p_label: op.label, p_category: op.category ?? null,
        p_to_wallet_id: op.toWalletId ?? null, p_fee: op.fee ?? 0, p_planned_item_id: op.plannedItemId ?? null,
        p_income_type: op.kind === 'rentree' ? op.incomeType ?? 'principal' : null,
      }),
    );
  }

  async saveIntent(i: NewIntent) {
    await run(
      this.db.from('purchase_intents').upsert(
        { client_key: i.clientKey, amount: i.amount, category: i.category, wallet_id: i.walletId, planned_date: i.date, status: i.status, remind_on: i.remindOn ?? null },
        { onConflict: 'user_id,client_key', ignoreDuplicates: true },
      ),
    );
  }

  async addDebt(d: NewDebt) {
    await run(this.db.from('debts').insert({
      direction: d.direction, person: d.person, initial_amount: d.initial, due_date: d.dueDate ?? null, wallet_id: d.walletId ?? null,
      certainty: d.direction === 'on_me_doit' ? d.certainty ?? 'incertaine' : null,
    }));
  }

  async payDebt(p: DebtPaymentInput) {
    await run(this.db.rpc('record_debt_payment', {
      p_client_key: p.clientKey, p_debt_id: p.debtId, p_amount: p.amount, p_wallet_id: p.walletId, p_date: p.date,
    }));
  }

  async cancelDebtPayment(paymentId: string) {
    await run(this.db.rpc('cancel_debt_payment', { p_payment_id: paymentId }));
  }

  async setDebtStatus(debtId: string, status: 'annulee' | 'remise') {
    await run(this.db.from('debts').update({ status }).eq('id', debtId));
  }

  async addGoal(g: NewGoal) {
    await run(this.db.from('goals').insert({
      name: g.name, target_amount: g.target, target_date: g.date, pocket_wallet_id: g.pocketWalletId,
      from_wallet_id: g.fromWalletId ?? null, planned_day: g.plannedDay,
    }));
  }

  async moveGoal(m: GoalMovementInput) {
    await run(this.db.rpc('record_goal_movement', {
      p_client_key: m.clientKey, p_goal_id: m.goalId, p_wallet_id: m.walletId, p_amount: m.amount, p_date: m.date, p_withdraw: m.withdraw,
    }));
  }

  async saveCycle(c: CycleSettings) {
    await run(this.db.from('user_settings').upsert({
      cycle_start_day: c.startDay, free_start: c.freeStart ?? null, free_next_start: c.freeNextStart ?? null,
    }, { onConflict: 'user_id' }));
  }

  async setCategoryCap(c: CategoryCap) {
    await run(this.db.from('category_caps').upsert({ category: c.category, cap: c.cap, pleasure: c.pleasure }, { onConflict: 'user_id,category' }));
  }

  async removeCategoryCap(category: string) {
    await run(this.db.from('category_caps').delete().eq('category', category));
  }

  async updateIntent(id: string, status: 'achete' | 'abandonne' | 'replanifie' | 'en_pause', date?: CivilDate) {
    await run(this.db.from('purchase_intents').update({ status, ...(date ? { planned_date: date } : {}) }).eq('id', id));
  }

  async updateOperation(id: string, p: OperationPatch) {
    await run(this.db.rpc('update_operation', {
      p_id: id, p_amount: p.amount, p_op_date: p.date, p_label: p.label, p_category: p.category ?? null, p_wallet_id: p.walletId,
    }));
  }

  async deleteOperation(id: string) {
    await run(this.db.rpc('delete_operation', { p_id: id }));
  }

  async addRecurring(r: NewRecurring) {
    await run(this.db.from('recurring_rules').insert({
      label: r.label, kind: r.kind, amount: r.amount, day: r.day, start_date: r.start, wallet_id: r.walletId, category: r.category ?? null,
    }));
  }

  async settleOccurrence(x: SettleInput) {
    await run(this.db.rpc('settle_occurrence', {
      p_client_key: x.clientKey, p_rule_id: x.ruleId, p_original: x.original, p_amount: x.amount, p_wallet_id: x.walletId, p_op_date: x.date,
    }));
  }

  async setOccurrence(ruleId: string, original: string, o: OccurrenceOverride | null) {
    if (!o) {
      await run(this.db.from('recurring_overrides').delete().eq('rule_id', ruleId).eq('original_date', original));
      return;
    }
    await run(this.db.from('recurring_overrides').upsert({
      rule_id: ruleId, original_date: original, new_date: o.date ?? null, new_amount: o.amount ?? null, skip: o.skip ?? false,
    }, { onConflict: 'rule_id,original_date' }));
  }

  async splitRecurring(ruleId: string, fromOriginal: string, p: { amount: number; day: number; label: string; walletId: string }) {
    await run(this.db.rpc('split_recurring_rule', {
      p_rule_id: ruleId, p_from_original: fromOriginal, p_amount: p.amount, p_day: p.day, p_label: p.label, p_wallet_id: p.walletId,
    }));
  }

  async stopRecurring(ruleId: string, end: string) {
    await run(this.db.from('recurring_rules').update({ end_date: end }).eq('id', ruleId));
  }

  async reschedulePlanned(id: string, date: string) {
    await run(this.db.from('planned_items').update({ due_date: date }).eq('id', id));
  }

  async deleteAccount() {
    await run(this.db.rpc('delete_my_account'));
  }
}
