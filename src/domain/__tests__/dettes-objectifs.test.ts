/// <reference types="jest" />
import {
  checkPayment, forecast, goalSchedule, incomeStats, progressOf, remainingOf, simulatePurchase, statusAfterPayments,
  type Debt, type Operation, type SavingsGoal, type Snapshot,
} from '..';

const today = '2026-11-12';
const wave = { id: 'wave', name: 'Wave', kind: 'wave' as const, everyday: true, balance: 50_000 };
const poche = { id: 'ep', name: 'Épargne', kind: 'epargne' as const, everyday: false, balance: 0 };

describe('Recette — Dette partielle', () => {
  const d: Debt = { id: 'd', direction: 'je_dois', person: 'Koffi', initial: 20_000, status: 'ouverte', payments: [] };
  it('5 000 F remboursés laissent 15 000 F ; annulation ramène à 20 000 F', () => {
    const paid = { ...d, payments: [{ id: 'p', amount: 5_000, date: today }] };
    expect(remainingOf(paid)).toBe(15_000);
    expect(remainingOf({ ...paid, payments: [] })).toBe(20_000);
  });
  it('refuse un paiement supérieur au reste', () => {
    expect(checkPayment({ ...d, payments: [{ id: 'p', amount: 5_000, date: today }] }, 15_001)).toMatch(/dépasse/);
    expect(checkPayment(d, 20_000)).toBeNull();
  });
  it('distingue réglée, annulée et remise', () => {
    expect(statusAfterPayments({ ...d, payments: [{ id: 'p', amount: 20_000, date: today }] })).toBe('reglee');
    expect(remainingOf({ ...d, status: 'remise' })).toBe(0);
    expect(statusAfterPayments({ ...d, status: 'annulee' })).toBe('annulee');
  });
  it('dette datée = sortie prévue ; non datée = signalée par le simulateur', () => {
    const snap: Snapshot = { today, wallets: [wave], planned: [], debts: [
      { ...d, dueDate: '2026-11-20', walletId: 'wave' },
      { ...d, id: 'd2', person: 'Awa', initial: 7_000 },
    ] };
    expect(forecast(snap).events.map((e) => e.item.label)).toEqual(['Rembourser Koffi']);
    expect(simulatePurchase(snap, { amount: 1_000, category: 'Autre', walletId: 'wave', date: today }).undatedDebts)
      .toEqual([{ id: 'd2', person: 'Awa', remaining: 7_000 }]);
  });
  it('créance incertaine par défaut : absente de la vue standard, présente si attendue', () => {
    const c: Debt = { id: 'c', direction: 'on_me_doit', person: 'Awa', initial: 15_000, dueDate: '2026-11-20', walletId: 'wave', status: 'ouverte', payments: [] };
    expect(forecast({ today, wallets: [wave], planned: [], debts: [c] }).events).toHaveLength(0);
    expect(forecast({ today, wallets: [wave], planned: [], debts: [{ ...c, certainty: 'attendue' }] }).events).toHaveLength(1);
  });
});

describe('Recette — Épargne', () => {
  const g: SavingsGoal = {
    id: 'g', name: 'Fonds d’urgence', target: 100_000, date: '2027-03-31', pocketWalletId: 'ep', fromWalletId: 'wave',
    plannedDay: 28, status: 'actif', movements: [],
  };
  it('échéancier arrondi au franc supérieur, somme exacte', () => {
    const s = goalSchedule(g, today);
    expect(s.installments.map((i) => i.date)).toEqual(['2026-11-28', '2026-12-28', '2027-01-28', '2027-02-28', '2027-03-28']);
    expect(s.perInstallment).toBe(20_000);
    const odd = goalSchedule({ ...g, target: 100_001 }, today);
    expect(odd.perInstallment).toBe(20_001);
    expect(odd.installments.reduce((a, i) => a + i.amount, 0)).toBe(100_001);
  });
  it('un versement réel réduit les versements prévus ; un retrait diminue la progression', () => {
    const after = { ...g, movements: [{ id: 'm', amount: 10_000, date: today }] };
    expect(progressOf(after)).toBe(10_000);
    expect(goalSchedule(after, today).perInstallment).toBe(18_000);
    expect(progressOf({ ...after, movements: [...after.movements, { id: 'r', amount: -4_000, date: today }] })).toBe(6_000);
  });
  it('date dépassée ou capacité insuffisante : nouvelle date proposée', () => {
    expect(goalSchedule({ ...g, date: '2026-11-01' }, today).suggestedDate).not.toBeNull();
    expect(goalSchedule(g, today, 10_000)).toMatchObject({ perInstallment: 10_000, suggestedDate: '2027-08-28' });
  });
  it('versements prévus : réduisent le quotidien, augmentent la poche', () => {
    const fc = forecast({ today, wallets: [wave, poche], planned: [], goals: [g] });
    const first = fc.events[0];
    expect(first.total).toBe(30_000);
    expect(first.balances.ep).toBe(20_000);
  });
});

it('statistiques de revenus : principal, petites sommes, dépenses du cycle', () => {
  const ops: Operation[] = [
    { id: '1', kind: 'rentree', walletId: 'wave', amount: 120_000, date: '2026-11-01', label: 'Salaire', incomeType: 'principal' },
    { id: '2', kind: 'rentree', walletId: 'wave', amount: 5_000, date: '2026-11-03', label: 'Coupure', incomeType: 'petite' },
    { id: '3', kind: 'sortie', walletId: 'wave', amount: 3_000, date: '2026-11-04', label: 'Garba' },
    { id: '4', kind: 'sortie', walletId: 'wave', amount: 9_000, date: '2026-11-05', label: 'Koffi', debtId: 'd' },
    { id: '5', kind: 'transfert', walletId: 'wave', toWalletId: 'om', amount: 10_000, fee: 100, date: '2026-11-06', label: 'OM' },
  ];
  const s = incomeStats(ops, today, '2026-11-01');
  expect(s.cycleMain).toBe(120_000);
  expect(s.cycleSmallIncomes).toEqual([{ date: '2026-11-03', amount: 5_000 }]);
  expect(s.cycleSpends.map((f) => f.amount)).toEqual([3_000, 100]);
});

it('un seul mois d’historique : la moyenne n’est pas divisée par 3', () => {
  const ops: Operation[] = [{ id: '1', kind: 'rentree', walletId: 'w', amount: 120_000, date: '2026-11-01', label: 'Salaire', incomeType: 'principal' }];
  expect(incomeStats(ops, '2026-11-12', '2026-11-01').mainMonthly).toBe(120_000);
  const three = [...ops, { ...ops[0], id: '2', date: '2026-10-01' }, { ...ops[0], id: '3', date: '2026-09-01' }];
  expect(incomeStats(three, '2026-11-12', '2026-11-01').mainMonthly).toBe(120_000);
});
