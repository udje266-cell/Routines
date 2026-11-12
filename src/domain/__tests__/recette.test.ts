/// <reference types="jest" />
import {
  forecast,
  formatFcfa,
  marginUntilNextIncome,
  monthlyOccurrences,
  simulatePurchase,
  splitRule,
  type PlannedItem,
  type Snapshot,
} from '..';

const wave = { id: 'wave', name: 'Wave', kind: 'wave' as const, everyday: true, balance: 30_000 };
const epargne = { id: 'ep', name: 'Épargne', kind: 'epargne' as const, everyday: false, balance: 0 };
const loyer: PlannedItem = {
  id: 'loyer', kind: 'sortie', label: 'Loyer', amount: 25_000, date: '2026-11-13', walletId: 'wave', source: 'facture',
};
const base: Snapshot = { today: '2026-11-12', wallets: [wave, epargne], planned: [loyer] };
const achat = { amount: 8_000, category: 'Loisirs', walletId: 'wave', date: '2026-11-12' };

describe('Recette — Achat avant le loyer', () => {
  it('signale 3 000 F manquants le 13, sur le loyer', () => {
    const r = simulatePurchase(base, achat);
    expect(r.verdict).toBe('risque');
    expect(r.shortfall).toMatchObject({ date: '2026-11-13', caused: 3_000, preexisting: 0 });
    expect(r.shortfall!.item.id).toBe('loyer');
    expect(r.alternativeDate).toBeNull();
  });

  it("la simulation ne modifie ni le plan ni le solde réel", () => {
    simulatePurchase(base, achat);
    expect(base.planned).toHaveLength(1);
    expect(wave.balance).toBe(30_000);
  });

  it("un achat de 5 000 F passe", () => {
    expect(simulatePurchase(base, { ...achat, amount: 5_000 }).verdict).toBe('ok');
  });
});

describe('Recette — Achat après la rentrée', () => {
  const salaire: PlannedItem = {
    id: 'sal', kind: 'rentree', label: 'Rentrée', amount: 20_000, date: '2026-11-16', walletId: 'wave', certainty: 'attendue',
  };
  const versement: PlannedItem = {
    id: 'v', kind: 'transfert', label: 'Épargne', amount: 10_000, date: '2026-11-17', walletId: 'wave', toWalletId: 'ep', source: 'epargne',
  };
  const snap: Snapshot = { ...base, planned: [loyer, salaire, versement] };

  it('propose le 17 et y laisse 7 000 F après le versement d\'épargne', () => {
    const r = simulatePurchase(snap, achat);
    expect(r.shortfall?.caused).toBe(3_000);
    expect(r.alternativeDate).toBe('2026-11-17');
    const fc = forecast(snap, 'standard', [{ ...versement, id: 'a', kind: 'sortie', amount: 8_000, toWalletId: undefined }]);
    const last17 = fc.events.filter((e) => e.date === '2026-11-17').pop()!;
    expect(last17.balances.wave).toBe(7_000);
  });

  it('achat le 17 : dépend de la rentrée (vue prudente en manque)', () => {
    const r = simulatePurchase(snap, { ...achat, date: '2026-11-17' });
    expect(r.verdict).toBe('depend_rentree');
    expect(r.dependsOn!.incomes.map((i) => i.id)).toEqual(['sal']);
  });

  it('rentrée en retard : aucune date ne convient', () => {
    const late = { ...snap, today: '2026-11-17', wallets: [{ ...wave, balance: 5_000 }, epargne], planned: [salaire, versement] };
    const r = simulatePurchase(late, { ...achat, date: '2026-11-17' });
    expect(r.verdict).toBe('risque');
    expect(r.alternativeDate).toBeNull();
    expect(forecast(late).lateIncomes.map((i) => i.id)).toEqual(['sal']);
  });

  it('même jour : sortie avant rentrée, sauf liaison explicite en vue standard', () => {
    const day: Snapshot = {
      today: '2026-11-12', wallets: [{ ...wave, balance: 0 }],
      planned: [
        { ...salaire, date: '2026-11-12' },
        { id: 'f', kind: 'sortie', label: 'Facture', amount: 5_000, date: '2026-11-12', walletId: 'wave' },
      ],
    };
    expect(forecast(day).events[0].item.id).toBe('f');
    day.planned[1].fundedByIncomeId = 'sal';
    expect(forecast(day).events[0].item.id).toBe('sal');
    expect(forecast(day, 'prudente').events[0].balances.wave).toBe(-5_000);
  });
});

describe('Recette — Deux vues de prévision', () => {
  const creance: PlannedItem = {
    id: 'c', kind: 'rentree', label: 'Awa me rembourse', amount: 15_000, date: '2026-11-20', walletId: 'wave', certainty: 'attendue', source: 'dette',
  };
  const snap: Snapshot = { ...base, planned: [creance] };
  it('apparaît en standard, disparaît en prudente, ne change pas le réel', () => {
    expect(forecast(snap, 'standard').events.at(-1)!.total).toBe(45_000);
    expect(forecast(snap, 'prudente').events).toHaveLength(0);
    expect(forecast(snap).start.total).toBe(30_000);
  });
  it('une rentrée incertaine est écartée de la vue standard', () => {
    const s = { ...base, planned: [{ ...creance, certainty: 'incertaine' as const }] };
    expect(forecast(s).events).toHaveLength(0);
  });
});

describe('Échéances et marge', () => {
  it("une sortie échue non réglée reste à couvrir aujourd'hui", () => {
    const fc = forecast({ ...base, planned: [{ ...loyer, date: '2026-11-01' }] });
    expect(fc.events[0]).toMatchObject({ date: '2026-11-12', overdue: true });
  });
  it('marge sans rentrée datée : indique la date manquante', () => {
    expect(marginUntilNextIncome(base)).toMatchObject({ amount: 5_000, missingIncomeDate: true });
  });
  it('un transfert entre portefeuilles du quotidien conserve le total', () => {
    const om = { id: 'om', name: 'Orange Money', kind: 'orange_money' as const, everyday: true, balance: 0 };
    const fc = forecast({ today: '2026-11-12', wallets: [wave, om], planned: [
      { id: 't', kind: 'transfert', label: 'Vers OM', amount: 10_000, date: '2026-11-12', walletId: 'wave', toWalletId: 'om' },
    ] });
    expect(fc.events[0].total).toBe(30_000);
  });
});

describe('Recette — Récurrence', () => {
  it('le 31 tombe au dernier jour des mois courts', () => {
    const occ = monthlyOccurrences({ day: 31, start: '2026-01-31' }, '2026-01-01', '2026-04-30');
    expect(occ.map((o) => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('modifier une occurrence laisse les autres', () => {
    const occ = monthlyOccurrences(
      { day: 31, start: '2026-01-31', overrides: { '2026-02-28': '2026-03-02' } }, '2026-01-01', '2026-04-30');
    expect(occ.map((o) => o.date)).toEqual(['2026-01-31', '2026-03-02', '2026-03-31', '2026-04-30']);
  });
  it('modifier les suivantes coupe la règle', () => {
    const [a, b] = splitRule({ day: 31, start: '2026-01-31' }, '2026-03-31', 5);
    expect(monthlyOccurrences(a, '2026-01-01', '2026-06-30')).toHaveLength(2);
    expect(monthlyOccurrences(b, '2026-01-01', '2026-06-30').map((o) => o.date)[0]).toBe('2026-04-05');
  });
});

it('formatFcfa', () => {
  expect(formatFcfa(30000)).toBe('30 000 F');
});
