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
