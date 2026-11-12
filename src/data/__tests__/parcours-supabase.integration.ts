/**
 * @jest-environment node
 */
/// <reference types="jest" />
// Parcours 1 de bout en bout contre la pile Supabase locale (données fictives).
// Lancer : npm run test:integration  (après `npx supabase start`)
import { createClient } from '@supabase/supabase-js';

import { simulatePurchase } from '@/domain';

import { SupabaseRepository } from '../supabase-repository';

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // clé publique locale par défaut
const run = describe;

async function newUser() {
  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@exemple.test`;
  const { error } = await db.auth.signUp({ email, password: 'motdepasse-de-test' });
  if (error) throw error;
  return db;
}

run('Parcours 1 — portefeuille, loyer, achat testé (Supabase local)', () => {
  it('signale 3 000 F manquants le 13 puis enregistre une seule opération', async () => {
    const db = await newUser();
    const repo = new SupabaseRepository(db);
    await repo.addWallet({ name: 'Wave', kind: 'wave', everyday: true, openingBalance: 30_000 });
    let snap = await repo.loadSnapshot('2026-11-12');
    const wave = snap.wallets[0];
    await repo.addPlanned({ kind: 'sortie', label: 'Loyer', amount: 25_000, date: '2026-11-13', walletId: wave.id, source: 'facture' });
    snap = await repo.loadSnapshot('2026-11-12');

    const r = simulatePurchase(snap, { amount: 8_000, category: 'Loisirs', walletId: wave.id, date: '2026-11-12' });
    expect(r.shortfall).toMatchObject({ date: '2026-11-13', caused: 3_000 });
    expect(r.shortfall!.item.label).toBe('Loyer');

    const op = { clientKey: 'achat-test-cle-stable', kind: 'sortie' as const, walletId: wave.id, amount: 8_000, date: '2026-11-12', label: 'Achat' };
    await repo.recordOperation(op);
    await repo.recordOperation(op); // réessai après coupure
    const { count } = await db.from('operations').select('*', { count: 'exact', head: true });
    expect(count).toBe(1);
    expect((await repo.loadSnapshot('2026-11-12')).wallets[0].balance).toBe(22_000);

    const other = new SupabaseRepository(await newUser());
    expect((await other.loadSnapshot('2026-11-12')).wallets).toHaveLength(0);
  });
});
