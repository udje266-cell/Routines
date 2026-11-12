/**
 * @jest-environment node
 */
/// <reference types="jest" />
// Parcours 1 de bout en bout contre la pile Supabase locale (données fictives).
// Lancer : npm run test:integration  (après `npx supabase start`)
import { createClient } from '@supabase/supabase-js';

import { categoryStatus, currentCycle, forecast, goalSchedule, incomeStats, progressOf, remainingOf, simulatePurchase } from '@/domain';

import { RefusedError } from '../repository';

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

  it('dettes, épargne et revenus typés', async () => {
    const repo = new SupabaseRepository(await newUser());
    const today = '2026-11-12';
    await repo.addWallet({ name: 'Wave', kind: 'wave', everyday: true, openingBalance: 50_000 });
    await repo.addWallet({ name: 'Épargne', kind: 'epargne', everyday: false, openingBalance: 0 });
    let snap = await repo.loadSnapshot(today);
    const [wave, poche] = snap.wallets;

    // Revenus typés
    await repo.recordOperation({ clientKey: 'revenu-principal-1', kind: 'rentree', walletId: wave.id, amount: 120_000, date: '2026-11-01', label: 'Salaire', incomeType: 'principal' });
    await repo.recordOperation({ clientKey: 'revenu-petite-0001', kind: 'rentree', walletId: wave.id, amount: 5_000, date: '2026-11-03', label: 'Coupure', incomeType: 'petite' });
    snap = await repo.loadSnapshot(today);
    expect(incomeStats(snap.operations!, today, '2026-11-01')).toMatchObject({ cycleMain: 120_000, cycleSmallIncomes: [{ amount: 5_000 }] });

    // Dette partielle puis annulation
    await repo.addDebt({ direction: 'je_dois', person: 'Koffi', initial: 20_000 });
    let debt = (await repo.loadSnapshot(today)).debts![0];
    const pay = { clientKey: 'remb-koffi-00001', debtId: debt.id, amount: 5_000, walletId: wave.id, date: today };
    await repo.payDebt(pay);
    await repo.payDebt(pay);
    debt = (await repo.loadSnapshot(today)).debts![0];
    expect(remainingOf(debt)).toBe(15_000);
    await expect(repo.payDebt({ ...pay, clientKey: 'remb-koffi-00002', amount: 15_001 })).rejects.toBeInstanceOf(RefusedError);
    await repo.cancelDebtPayment(debt.payments[0].id);
    expect(remainingOf((await repo.loadSnapshot(today)).debts![0])).toBe(20_000);

    // Objectif : versement, retrait, échéancier
    await repo.addGoal({ name: 'Fonds d’urgence', target: 100_000, date: '2027-03-31', pocketWalletId: poche.id, fromWalletId: wave.id, plannedDay: 28 });
    let goal = (await repo.loadSnapshot(today)).goals![0];
    await repo.moveGoal({ clientKey: 'versement-00001', goalId: goal.id, walletId: wave.id, amount: 10_000, date: today, withdraw: false });
    await repo.moveGoal({ clientKey: 'retrait-0000001', goalId: goal.id, walletId: wave.id, amount: 4_000, date: today, withdraw: true });
    snap = await repo.loadSnapshot(today);
    goal = snap.goals![0];
    expect(progressOf(goal)).toBe(6_000);
    expect(snap.wallets.find((w) => w.id === poche.id)!.balance).toBe(6_000);
    expect(goalSchedule(goal, today).perInstallment).toBe(18_800);
  });

  it('cycle, enveloppes, achat en pause et historique modifiable', async () => {
    const repo = new SupabaseRepository(await newUser());
    const today = '2026-11-12';
    await repo.addWallet({ name: 'Wave', kind: 'wave', everyday: true, openingBalance: 50_000 });
    const wave = (await repo.loadSnapshot(today)).wallets[0];

    await repo.saveCycle({ startDay: 25 });
    await repo.setCategoryCap({ category: 'Sorties', cap: 22_500, pleasure: true });
    await repo.recordOperation({ clientKey: 'sortie-maquis-01', kind: 'sortie', walletId: wave.id, amount: 12_000, date: '2026-11-03', label: 'Maquis', category: 'Sorties' });
    let snap = await repo.loadSnapshot(today);
    expect(currentCycle(snap)).toEqual({ start: '2026-10-25', end: '2026-11-24' });
    expect(categoryStatus(snap.categories!, snap.operations!, currentCycle(snap))[0]).toMatchObject({ spent: 12_000, left: 10_500 });

    // Pause puis abandon : aucune opération, aucune épargne
    await repo.saveIntent({ clientKey: 'intent-pause-001', amount: 18_000, category: 'Habillement', walletId: wave.id, date: '2026-11-13', status: 'en_pause' });
    snap = await repo.loadSnapshot(today);
    expect(snap.intents![0]).toMatchObject({ status: 'en_pause', createdOn: expect.any(String) });
    await repo.updateIntent(snap.intents![0].id, 'abandonne');
    snap = await repo.loadSnapshot(today);
    expect(snap.intents![0].status).toBe('abandonne');
    expect(snap.operations).toHaveLength(1);

    // Correction puis suppression
    const op = snap.operations![0];
    await repo.updateOperation(op.id, { amount: 10_000, date: op.date, label: 'Maquis', category: 'Sorties', walletId: wave.id });
    expect((await repo.loadSnapshot(today)).wallets[0].balance).toBe(40_000);
    await repo.deleteOperation(op.id);
    expect((await repo.loadSnapshot(today)).wallets[0].balance).toBe(50_000);
  });

  it('dépenses mensuelles : prévision, règlement unique, exception et modification des suivantes', async () => {
    const repo = new SupabaseRepository(await newUser());
    const today = '2026-11-12';
    await repo.addWallet({ name: 'Wave', kind: 'wave', everyday: true, openingBalance: 100_000 });
    const wave = (await repo.loadSnapshot(today)).wallets[0];
    await repo.addRecurring({ label: 'Loyer', kind: 'sortie', amount: 25_000, day: 31, start: '2026-11-01', walletId: wave.id, category: 'Logement' });
    let snap = await repo.loadSnapshot(today);
    const rule = snap.recurring![0];
    expect(forecast(snap).events.map((e) => [e.date, e.item.amount])).toEqual([['2026-11-30', 25_000], ['2026-12-31', 25_000]]);

    const settle = { clientKey: 'loyer-nov-cle-01', ruleId: rule.id, original: '2026-11-30', amount: 25_000, walletId: wave.id, date: today };
    await repo.settleOccurrence(settle);
    await repo.settleOccurrence(settle);
    await repo.setOccurrence(rule.id, '2026-12-31', { date: '2027-01-03', amount: 27_000 });
    snap = await repo.loadSnapshot(today);
    expect(snap.wallets[0].balance).toBe(75_000);
    expect(forecast(snap).events.map((e) => [e.date, e.item.amount])).toEqual([['2027-01-03', 27_000]]);

    await repo.splitRecurring(rule.id, '2027-01-31', { amount: 30_000, day: 5, label: 'Loyer', walletId: wave.id });
    snap = await repo.loadSnapshot('2027-01-04');
    // Le loyer de décembre déplacé au 3 janvier n'est pas payé : il reste à couvrir aujourd'hui, puis la nouvelle règle.
    expect(forecast(snap).events.map((e) => [e.date, e.item.amount])).toEqual([['2027-01-04', 27_000], ['2027-02-05', 30_000]]);
  });
});
