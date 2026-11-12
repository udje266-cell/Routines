/// <reference types="jest" />
import { monthBounds, monthPlan, type RecurringRule, type Snapshot } from '..';

const rule = (id: string, label: string, kind: 'sortie' | 'rentree', amount: number, day: number): RecurringRule => ({
  id, label, kind, amount, day, start: '2026-11-01', walletId: 'w', overrides: {}, settled: [],
});
const snap: Snapshot = {
  today: '2026-11-03',
  wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 60_000 }],
  planned: [],
  operations: [{ id: 'o1', kind: 'sortie', walletId: 'w', amount: 5_000, date: '2026-11-02', label: 'Marché', category: 'Alimentation' }],
  recurring: [rule('sal', 'Salaire', 'rentree', 120_000, 25), rule('loyer', 'Loyer', 'sortie', 40_000, 5), rule('cie', 'CIE', 'sortie', 10_000, 15)],
};

it('bornes du mois', () => {
  expect(monthBounds('2026-02-14')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
});

it('jour par jour : ce qui est fait et ce qui est prévu', () => {
  const p = monthPlan(snap);
  expect(p.days['2026-11-02'].map((e) => [e.label, e.done])).toEqual([['Marché', true]]);
  expect(p.days['2026-11-25'][0]).toMatchObject({ label: 'Salaire', kind: 'entree', done: false });
  expect(p.days['2026-11-05'][0]).toMatchObject({ label: 'Loyer', kind: 'sortie' });
});

it('combien et quand économiser', () => {
  const p = monthPlan(snap);
  expect(p).toMatchObject({ income: 120_000, expenses: 55_000, left: 65_000 });
  // 20 % de 120 000 F = 24 000 F, à mettre de côté le jour du salaire
  expect(p.advice).toMatchObject({ save: 24_000, saveOn: '2026-11-25' });
  expect(p.advice.perDay).toBe(Math.floor((65_000 - 24_000) / 28));
  expect(p.advice.steps[0]).toMatch(/« Salaire ».*24 000 F/);
});

it('le moment compte : s’il manque de l’argent avant la paie, on comble d’abord', () => {
  // 20 000 F sur le compte, loyer de 40 000 F le 5 et CIE de 10 000 F le 15, salaire le 25 : jusqu'à 30 000 F manquent avant la paie.
  const p = monthPlan({ ...snap, wallets: [{ ...snap.wallets[0], balance: 20_000 }] });
  expect(p.left).toBe(65_000);
  expect(p.advice.cashGap).toEqual({ amount: 30_000, date: '2026-11-05' });
  expect(p.advice.save).toBe(24_000); // 65 000 − 30 000 = 35 000 F disponibles, 24 000 F conseillés
  expect(p.advice.steps[0]).toMatch(/D’abord.*05-11.*30\u00a0000\u00a0F/);
  expect(p.advice.steps[1]).toMatch(/Loyer/);
});

it('mois déficitaire : pas d’épargne, quoi reporter', () => {
  const p = monthPlan({ ...snap, recurring: [rule('sal', 'Salaire', 'rentree', 30_000, 25), rule('loyer', 'Loyer', 'sortie', 40_000, 5)] });
  expect(p.advice.save).toBe(0);
  expect(p.advice.shortBy).toBe(15_000);
  expect(p.advice.steps[1]).toMatch(/Loyer/);
});

describe('dettes dans le plan du mois', () => {
  const debt = (id: string, initial: number, dueDate?: string, walletId?: string) => ({
    id, direction: 'je_dois' as const, person: id, initial, dueDate, walletId, status: 'ouverte' as const, payments: [],
  });
  const base = monthPlan(snap);

  it('une dette sans date est étalée sur 3 mois et passe avant l’épargne', () => {
    const p = monthPlan({ ...snap, debts: [debt('Awa', 30_000)] });
    expect(p.debtReserve).toBe(10_000);
    expect(p.left).toBe(base.left - 10_000);
    expect(p.advice.save).toBeLessThanOrEqual(base.advice.save);
    expect(p.advice.steps.some((s) => s.includes('Remboursez d’abord vos dettes'))).toBe(true);
  });

  it('une dette datée plus tard est répartie jusqu’à sa date ; échue ou sans compte, tout est dû', () => {
    expect(monthPlan({ ...snap, debts: [debt('Koffi', 60_000, '2027-01-20', 'w')] }).debtReserve).toBe(20_000);
    expect(monthPlan({ ...snap, debts: [debt('Yao', 15_000, '2026-10-01')] }).debtReserve).toBe(15_000);
  });

  it('une dette datée dans le mois avec un compte n’est pas comptée deux fois', () => {
    const p = monthPlan({ ...snap, debts: [debt('Ali', 8_000, '2026-11-20', 'w')] });
    expect(p.debtReserve).toBe(0);
    expect(p.expenses).toBe(base.expenses + 8_000);
  });

  it('une créance (on me doit) ne réduit pas ce qui reste', () => {
    const p = monthPlan({ ...snap, debts: [{ ...debt('Moi', 50_000), direction: 'on_me_doit' as const }] });
    expect(p.debtReserve).toBe(0);
  });
});
