/// <reference types="jest" />
import { safeToSpend, type Snapshot } from '..';

const base: Snapshot = {
  today: '2026-11-12',
  wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 100_000 }],
  planned: [
    { id: 'loyer', kind: 'sortie', label: 'Loyer', amount: 40_000, date: '2026-11-15', walletId: 'w' },
    { id: 'paie', kind: 'rentree', label: 'Salaire', amount: 120_000, date: '2026-11-22', walletId: 'w', certainty: 'attendue' },
  ],
};

it('répartit ce qui reste après les factures jusqu’à la veille de la paie', () => {
  // 100 000 − 40 000 = 60 000 F sur 10 jours (du 12 au 21) = 6 000 F par jour
  expect(safeToSpend(base)).toMatchObject({ perDay: 6_000, afterBills: 60_000, days: 10, until: '2026-11-21' });
});

it('rien à dépenser quand les factures dépassent l’argent disponible', () => {
  const r = safeToSpend({ ...base, wallets: [{ ...base.wallets[0], balance: 30_000 }] });
  expect(r.perDay).toBe(0);
  expect(r.afterBills).toBe(-10_000);
});

it('sans paie datée : jusqu’à la fin de la période choisie', () => {
  const r = safeToSpend({ ...base, planned: [base.planned[0]] }, '2026-11-30');
  expect(r).toMatchObject({ days: 19, until: '2026-11-30', nextIncome: null, perDay: Math.floor(60_000 / 19) });
});

describe('dettes dans « Je peux dépenser aujourd’hui »', () => {
  const snap: Snapshot = {
    today: '2026-11-03',
    wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 100_000 }],
    planned: [{ id: 'sal', kind: 'rentree', label: 'Salaire', amount: 120_000, date: '2026-11-13', walletId: 'w' }],
  };
  const debt = (id: string, initial: number, dueDate?: string, walletId?: string) => ({
    id, direction: 'je_dois' as const, person: id, initial, dueDate, walletId, status: 'ouverte' as const, payments: [],
  });
  const base = safeToSpend(snap);

  it('une dette sans date réserve un tiers d’ici la paie', () => {
    const s = safeToSpend({ ...snap, debts: [debt('Awa', 30_000)] });
    expect(s.debtReserve).toBe(10_000);
    expect(s.afterBills).toBe(base.afterBills - 10_000);
    expect(s.perDay).toBe(Math.floor((base.afterBills - 10_000) / s.days));
  });

  it('une dette datée avec compte avant la paie n’est pas comptée deux fois', () => {
    const s = safeToSpend({ ...snap, debts: [debt('Ali', 8_000, '2026-11-08', 'w')] });
    expect(s.debtReserve).toBe(0);
    expect(s.afterBills).toBe(base.afterBills - 8_000);
  });

  it('une créance ne change rien', () => {
    expect(safeToSpend({ ...snap, debts: [{ ...debt('X', 50_000), direction: 'on_me_doit' as const }] }).afterBills).toBe(base.afterBills);
  });
});

describe('argent attendu sûr dans « Je peux dépenser aujourd’hui »', () => {
  const rule = { id: 'sal', label: 'Salaire', kind: 'rentree' as const, amount: 120_000, day: 25, start: '2026-11-01', walletId: 'w', overrides: {}, settled: [] };
  const snap: Snapshot = {
    today: '2026-11-03',
    wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 22_000 }],
    planned: [],
    recurring: [rule],
  };
  const attendu = (certainty: 'attendue' | 'incertaine') => ({
    ...snap, planned: [{ id: 'p', kind: 'rentree' as const, label: 'Client', amount: 44_000, date: '2026-11-13', walletId: 'w', certainty }],
  });

  it('une rentrée sûre avant la paie augmente ce qu’on peut dépenser (à partir de sa date)', () => {
    const sans = safeToSpend(snap);
    const avec = safeToSpend(attendu('attendue'));
    expect(sans.nextIncome?.label).toBe('Salaire');
    expect(avec.nextIncome?.label).toBe('Salaire'); // la paie reste la borne
    expect(sans.perDay).toBe(1_000); // 22 000 F sur 22 jours
    expect(avec.perDay).toBe(2_200); // 22 000 F tiennent 10 jours avant l’arrivée des 44 000 F (66 000 / 22 = 3 000)
  });

  it('une rentrée « pas sûr » n’est pas comptée', () => {
    expect(safeToSpend(attendu('incertaine')).perDay).toBe(safeToSpend(snap).perDay);
  });
});
