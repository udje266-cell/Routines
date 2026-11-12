/// <reference types="jest" />
import {
  advise, categoryTrends, financialHealth, futureValue, netWorth, placementFor, ratios, unusualSpends,
  type LoanRecord, type Operation, type RecurringRule, type Snapshot,
} from '..';

const today = '2026-11-20';
const wallets = [
  { id: 'wave', name: 'Wave', kind: 'wave' as const, everyday: true, balance: 60_000 },
  { id: 'ep', name: 'Épargne', kind: 'epargne' as const, everyday: false, balance: 40_000 },
];
const loyer: RecurringRule = {
  id: 'loyer', label: 'Loyer', kind: 'sortie', amount: 50_000, day: 5, start: '2026-08-01', walletId: 'wave', overrides: {},
  settled: ['2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05'],
};
const salaire: RecurringRule = {
  id: 'salaire', label: 'Salaire', kind: 'rentree', amount: 120_000, day: 1, start: '2026-12-01', walletId: 'wave', overrides: {}, settled: [],
};
const pret: LoanRecord = {
  id: 'pret', label: 'Prêt microfinance', lenderType: 'microfinance', principal: 300_000, annualRate: 0.22, months: 10,
  firstDueDate: '2026-12-10', method: 'annuite', fees: 6_000, insuranceMonthly: 0, walletId: 'wave', paid: [], extras: [], status: 'en_cours', disbursed: true,
};

/** Trois mois d'historique : salaire 120 000 F, petites coupures 150 000 F, dépenses de quotidien. */
function history(): Operation[] {
  const ops: Operation[] = [];
  let id = 0;
  for (const m of ['2026-08', '2026-09', '2026-10', '2026-11']) {
    ops.push({ id: `${++id}`, kind: 'rentree', walletId: 'wave', amount: 120_000, date: `${m}-01`, label: 'Salaire', incomeType: 'principal' });
    for (let d = 2; d <= 16; d += 2) ops.push({ id: `${++id}`, kind: 'rentree', walletId: 'wave', amount: m === '2026-11' ? 10_000 : 18_750, date: `${m}-${String(d).padStart(2, '0')}`, label: 'Coupure', incomeType: 'petite' });
    for (let d = 3; d <= 19; d += 4) ops.push({ id: `${++id}`, kind: 'sortie', walletId: 'wave', amount: 2_000, date: `${m}-${String(d).padStart(2, '0')}`, label: 'Garba', category: 'Alimentation' });
    ops.push({ id: `${++id}`, kind: 'sortie', walletId: 'wave', amount: m === '2026-11' ? 30_000 : 8_000, date: `${m}-12`, label: 'Maquis', category: 'Sorties' });
    ops.push({ id: `${++id}`, kind: 'transfert', walletId: 'wave', toWalletId: 'ep', amount: 10_000, date: `${m}-02`, label: 'Épargne' });
  }
  return ops;
}
const snap: Snapshot = { today, wallets, planned: [], operations: history(), recurring: [loyer], loans: [pret] };

describe('Analyse', () => {
  it('patrimoine net : actifs moins crédits et dettes', () => {
    const n = netWorth({ ...snap, debts: [{ id: 'd', direction: 'je_dois', person: 'Koffi', initial: 20_000, status: 'ouverte', payments: [] }] });
    expect(n).toMatchObject({ liquid: 60_000, savings: 40_000, loans: 300_000, personalDebts: 20_000, net: 100_000 - 320_000 });
  });
  it('ratios : charges fixes = loyer + mensualité du crédit', () => {
    const r = ratios(snap);
    expect(r.mainIncome).toBe(120_000);
    expect(r.loanPayments).toBe(33_108); // vérifié par un calcul indépendant
    expect(r.fixedCharges).toBe(83_108);
    expect(r.emergencyMonths).toBeCloseTo(40_000 / 83_108, 3);
    expect(r.debtService).toBeCloseTo(33_108 / 120_000, 3);
  });
  it('tendances : même dépense qu’aux mois précédents = pas de hausse', () => {
    expect(categoryTrends(snap.operations!, today).find((x) => x.category === 'Alimentation')!.change).toBe(0);
  });
  it('tendances : sorties en forte hausse ce mois-ci', () => {
    const t = categoryTrends(snap.operations!, today).find((x) => x.category === 'Sorties')!;
    expect(t.average).toBe(8_000);
    expect(t.current).toBe(30_000);
    expect(t.change).toBeGreaterThan(1);
  });
  it('dépense inhabituelle repérée', () => {
    const ops = [...history(), { id: 'x', kind: 'sortie' as const, walletId: 'wave', amount: 25_000, date: '2026-11-18', label: 'Garba géant', category: 'Alimentation' }];
    expect(unusualSpends(ops, today).map((o) => o.id)).toEqual(['x']);
  });
  it('score de santé : cinq piliers sur 20, total sur 100', () => {
    const h = financialHealth(snap);
    expect(h.pillars).toHaveLength(5);
    expect(h.score).toBe(h.pillars.reduce((s, p) => s + p.score, 0));
    expect(h.pillars.find((p) => p.key === 'securite')!.status).toBe('risque');
  });
});

describe('Conseiller', () => {
  it('priorités d’un banquier prudent : sécurité avant placement', () => {
    const a = advise(snap);
    expect(a[0].priority).toBe(1);
    expect(a.map((x) => x.id)).toContain('urgence-1');
    expect(a.map((x) => x.id)).toContain('coupures');
    expect(a.map((x) => x.id)).not.toContain('placer');
    expect(a.map((x) => x.id)).toContain('hausse-Sorties');
  });
  it('taux au-dessus du plafond légal signalé', () => {
    expect(advise({ ...snap, loans: [{ ...pret, annualRate: 0.3 }] }).map((x) => x.id)).toContain('usure-pret');
  });
  it('épargne excédentaire et pas d’urgence : proposer un placement', () => {
    const rich: Snapshot = { ...snap, recurring: [loyer, salaire], loans: [], wallets: [wallets[0], { ...wallets[1], balance: 600_000 }], operations: history().filter((o) => o.category !== 'Sorties') };
    const a = advise(rich);
    expect(a.find((x) => x.id === 'placer')!.impact!.amount).toBeGreaterThan(0);
  });
  it('fonds d’urgence complet et crédit cher : remboursement anticipé conseillé', () => {
    const a = advise({ ...snap, wallets: [wallets[0], { ...wallets[1], balance: 400_000 }] });
    expect(a.find((x) => x.id === 'anticipe-pret')!.impact!.amount).toBeGreaterThan(0);
  });
});

describe('Placements', () => {
  it('capitalisation mensuelle', () => {
    expect(futureValue(100_000, 0, 0, 12)).toBe(100_000);
    expect(futureValue(0, 10_000, 0, 12)).toBe(120_000);
    expect(futureValue(100_000, 0, 0.06, 12)).toBe(106_168);
  });
  it('sécurité d’abord, rendement selon l’horizon', () => {
    expect(placementFor(60, false).id).toBe('livret');
    expect(placementFor(12, true).id).toBe('dat');
    expect(placementFor(36, true).id).toBe('titres_publics');
  });
});
