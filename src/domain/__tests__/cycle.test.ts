/// <reference types="jest" />
import { categoryStatus, cycleBounds, cycleDay, cycleReview, simulatePurchase, type CategoryCap, type Operation, type Snapshot } from '..';

describe('Cycle', () => {
  it('cycle au 25 : du 25 au 24 du mois suivant', () => {
    expect(cycleBounds('2026-11-12', { startDay: 25 })).toEqual({ start: '2026-10-25', end: '2026-11-24' });
    expect(cycleBounds('2026-11-25', { startDay: 25 })).toEqual({ start: '2026-11-25', end: '2026-12-24' });
  });
  it('jour 31 : ramené au dernier jour des mois courts', () => {
    expect(cycleBounds('2027-02-28', { startDay: 31 })).toEqual({ start: '2027-02-28', end: '2027-03-30' });
    expect(cycleBounds('2027-02-27', { startDay: 31 })).toEqual({ start: '2027-01-31', end: '2027-02-27' });
  });
  it('mode à dates libres', () => {
    expect(cycleBounds('2026-11-12', { startDay: 1, freeStart: '2026-11-05', freeNextStart: '2026-11-20' }))
      .toEqual({ start: '2026-11-05', end: '2026-11-19' });
  });
  it('jour du cycle', () => {
    expect(cycleDay('2026-11-12', { start: '2026-11-01', end: '2026-11-30' })).toEqual({ day: 12, length: 30 });
  });
});

const ops: Operation[] = [
  { id: '1', kind: 'sortie', walletId: 'w', amount: 12_000, date: '2026-11-03', label: 'Maquis', category: 'Sorties' },
  { id: '2', kind: 'sortie', walletId: 'w', amount: 6_000, date: '2026-11-08', label: 'Jeux', category: 'Sorties' },
  { id: '3', kind: 'sortie', walletId: 'w', amount: 9_000, date: '2026-10-28', label: 'Ancien', category: 'Sorties' },
  { id: '4', kind: 'rentree', walletId: 'w', amount: 120_000, date: '2026-11-01', label: 'Salaire', incomeType: 'principal' },
  { id: '5', kind: 'rentree', walletId: 'w', amount: 5_000, date: '2026-11-04', label: 'Coupure', incomeType: 'petite' },
  { id: '6', kind: 'transfert', walletId: 'w', toWalletId: 'ep', amount: 10_000, date: '2026-11-05', label: 'Épargne', goalId: 'g' },
  { id: '7', kind: 'sortie', walletId: 'w', amount: 5_000, date: '2026-11-06', label: 'Koffi', debtId: 'd' },
];
const caps: CategoryCap[] = [{ category: 'Sorties', cap: 22_500, pleasure: true }];
const b = { start: '2026-11-01', end: '2026-11-30' };

it('plafonds : seules les dépenses du cycle comptent', () => {
  expect(categoryStatus(caps, ops, b)[0]).toMatchObject({ spent: 18_000, left: 4_500, status: 'presque' });
});

it('simulateur : coût pour le budget plaisir et montant à réaffecter', () => {
  const snap: Snapshot = { today: '2026-11-12', wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 100_000 }],
    planned: [], operations: ops, categories: caps, cycle: { startDay: 1 } };
  const r = simulatePurchase(snap, { amount: 8_000, category: 'Sorties', walletId: 'w', date: '2026-11-12' });
  expect(r.pleasure).toEqual({ category: 'Sorties', leftAfter: -3_500 });
  expect(r.categoryOverrun).toMatchObject({ over: 3_500 });
});

it('bilan : abandonné séparé de l’épargne versée', () => {
  const r = cycleReview(caps, ops, [
    { id: 'i', amount: 15_000, category: 'Sorties', walletId: 'w', date: '2026-11-09', status: 'abandonne', createdOn: '2026-11-09' },
  ], b, ['ep']);
  expect(r).toMatchObject({
    income: { main: 120_000, small: 5_000 }, spending: 18_000, debtsPaid: 5_000, saved: 10_000,
    abandoned: { count: 1, total: 15_000 }, pleasure: { cap: 22_500, spent: 18_000 },
  });
});
