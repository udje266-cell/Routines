import type { SupabaseClient } from '@supabase/supabase-js';

import type { CivilDate, PlannedItem, Wallet } from '@/domain';

import { ConnectionRequiredError, type FinanceRepository, type NewIntent, type NewOperation, type NewPlanned, type NewWallet } from './repository';

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
    throw res.error;
  }
  return res.data;
}

export class SupabaseRepository implements FinanceRepository {
  readonly mode = 'compte' as const;
  constructor(private db: SupabaseClient) {}

  async loadSnapshot(today: CivilDate) {
    const [wallets, balances, planned] = await Promise.all([
      run(this.db.from('wallets').select('id,name,kind,everyday').order('created_at')),
      run(this.db.from('wallet_balances').select('wallet_id,balance')),
      run(this.db.from('planned_items').select('*').eq('status', 'prevue').order('due_date')),
    ]);
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
}
