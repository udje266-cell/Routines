/// <reference types="jest" />
import { advise, forecast, monthPlan, simulatePurchase, type RecurringRule, type Snapshot } from '..';

const rule = (id: string, label: string, kind: 'sortie' | 'rentree', amount: number, day: number, start = '2026-11-01'): RecurringRule => ({
  id, label, kind, amount, day, start, walletId: 'w', overrides: {}, settled: [],
});
const debt = (id: string, initial: number, dueDate?: string, walletId?: string) => ({
  id, direction: 'je_dois' as const, person: id, initial, dueDate, walletId, status: 'ouverte' as const, payments: [],
});

// Le cas réel : compte vide, 115 000 F attendus le 14, 4 dettes le 15, 34 000 F le 17, 150 000 F le 20, salaire le 30.
const reel: Snapshot = {
  today: '2026-11-12',
  wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 0 }, { id: 'e', name: 'Épargne', kind: 'epargne', everyday: false, balance: 0 }],
  planned: [
    { id: 'p1', kind: 'rentree', label: 'Client', amount: 115_000, date: '2026-11-14', walletId: 'w', certainty: 'attendue' },
    { id: 'p2', kind: 'sortie', label: 'Envoi', amount: 34_000, date: '2026-11-17', walletId: 'w' },
    { id: 'p3', kind: 'rentree', label: 'Prime', amount: 150_000, date: '2026-11-20', walletId: 'w', certainty: 'attendue' },
  ],
  recurring: [rule('s', 'Salaire', 'rentree', 75_000, 30), rule('t', 'Transport', 'sortie', 40_000, 1, '2026-12-01'), rule('i', 'Internet', 'sortie', 10_000, 5, '2026-12-01')],
  goals: [{ id: 'g', name: 'Coussin', target: 150_000, date: '2027-11-12', pocketWalletId: 'e', fromWalletId: 'w', plannedDay: 28, status: 'actif', movements: [] }],
  debts: [debt('Awa', 20_000, '2026-11-15', 'w'), debt('Yao', 20_000, '2026-11-15', 'w'), debt('Ali', 25_000, '2026-11-15', 'w'), debt('Ama', 10_000, '2026-11-15', 'w')],
};

describe('un seul budget du jour pour tous les écrans', () => {
  it('compte vide aujourd’hui : 0 F aujourd’hui, partout', () => {
    const p = monthPlan(reel);
    expect(p.budget.today).toBe(0);
    expect(p.advice.steps.join(' ')).toMatch(/Jusqu’au 13-11 : au plus 0.F/);
  });

  it('l’épargne du plan ne double pas le versement d’objectif déjà prévu', () => {
    const p = monthPlan(reel);
    expect(p.savingsPlanned).toBe(12_500);
    expect(p.advice.save).toBeLessThanOrEqual(68_000 - 12_500);
  });

  it('dette sans date : l’épargne et la limite par jour baissent d’autant', () => {
    const sans = monthPlan({ ...reel, today: '2026-11-21', planned: [], wallets: [{ ...reel.wallets[0], balance: 200_000 }, reel.wallets[1]], debts: [] });
    const avec = monthPlan({ ...reel, today: '2026-11-21', planned: [], wallets: [{ ...reel.wallets[0], balance: 200_000 }, reel.wallets[1]], debts: [debt('Awa', 30_000)] });
    expect(avec.debtReserve).toBe(10_000);
    const total = (p: typeof sans) => p.advice.save + p.budget.segments.reduce((s, g) => s + g.perDay * ((Date.parse(g.until) - Date.parse(g.from)) / 86_400_000 + 1), 0);
    expect(total(sans) - total(avec)).toBeGreaterThanOrEqual(9_990);
  });

  it('dette datée sans compte : dans l’Agenda et dans le test d’achat', () => {
    const s = { ...reel, debts: [debt('Koffi', 20_000, '2026-11-22')] };
    expect(forecast(s).events.some((e) => e.item.label === 'Rembourser Koffi')).toBe(true);
  });

  it('argent qui manque : pas d’épargne conseillée, versements mis en pause, même manque pour le conseiller', () => {
    const s: Snapshot = { ...reel, planned: [reel.planned[1]] }; // aucune rentrée avant le 30, dettes et envoi le 15 et le 17
    const p = monthPlan(s);
    expect(p.budget.shortage).not.toBeNull();
    expect(p.advice.save).toBe(0);
    expect(p.budget.savingsPaused).toBe(true);
    expect(p.budget.today).toBe(0);
    const m = advise(s).find((a) => a.id === 'manque')!;
    expect(m.impact!.amount).toBe(p.budget.shortage!.amount);
  });

  it('tester un achat : un petit achat n’est plus « dépend d’une rentrée » à cause d’un déficit lointain sans salaire', () => {
    const a: Snapshot = {
      today: '2026-11-14', wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 45_000 }], planned: [],
      recurring: [rule('sal', 'Salaire', 'rentree', 120_000, 25), rule('l', 'Loyer', 'sortie', 40_000, 5, '2026-12-01')],
    };
    expect(simulatePurchase(a, { amount: 100, category: 'Repas', walletId: 'w', date: '2026-11-14' }).verdict).toBe('ok');
  });

  it('objectif dont la date est passée : pas de versement d’un coup dans la prévision', () => {
    const s = { ...reel, goals: [{ ...reel.goals![0], date: '2026-11-01' }] };
    expect(forecast(s).events.some((e) => e.item.source === 'epargne')).toBe(false);
  });
});
