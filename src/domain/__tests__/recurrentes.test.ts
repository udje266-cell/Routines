/// <reference types="jest" />
import { forecast, monthlyFixedTotal, ruleOccurrences, upcomingEssentials, type RecurringRule, type Snapshot } from '..';

const loyer: RecurringRule = {
  id: 'loyer', label: 'Loyer', kind: 'sortie', amount: 25_000, day: 31, start: '2026-11-01', walletId: 'w',
  category: 'Logement', overrides: {}, settled: [],
};
const snap = (r: RecurringRule[], today = '2026-11-12'): Snapshot => ({
  today, wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 100_000 }], planned: [], recurring: r,
});

describe('Dépenses mensuelles', () => {
  it('au 31 : tombe le 30 novembre, puis le 31 décembre', () => {
    expect(ruleOccurrences(loyer, '2026-11-01', '2027-01-10').map((o) => o.date)).toEqual(['2026-11-30', '2026-12-31']);
  });
  it('entrent dans la prévision sur 60 jours', () => {
    expect(forecast(snap([loyer])).events.map((e) => e.date)).toEqual(['2026-11-30', '2026-12-31']);
  });
  it('occurrence réglée : sort de la prévision ; non réglée échue : à couvrir aujourd’hui', () => {
    expect(forecast(snap([{ ...loyer, settled: ['2026-11-30'] }])).events).toHaveLength(1);
    const late = forecast(snap([loyer], '2026-12-05'));
    expect(late.events[0]).toMatchObject({ date: '2026-12-05', overdue: true });
  });
  it('modifier une seule occurrence (date et montant) laisse les autres', () => {
    const r = { ...loyer, overrides: { '2026-11-30': { date: '2026-12-03', amount: 27_000 } } };
    expect(forecast(snap([r])).events.map((e) => [e.date, e.item.amount])).toEqual([['2026-12-03', 27_000], ['2026-12-31', 25_000]]);
  });
  it('sauter une occurrence', () => {
    expect(forecast(snap([{ ...loyer, overrides: { '2026-11-30': { skip: true } } }])).events).toHaveLength(1);
  });
  it('règle arrêtée : plus d’occurrence après la fin', () => {
    expect(forecast(snap([{ ...loyer, end: '2026-12-01' }])).events).toHaveLength(1);
  });
  it('total mensuel et charges des 30 jours', () => {
    const elec = { ...loyer, id: 'cie', label: 'Électricité', amount: 12_000, day: 15 };
    expect(monthlyFixedTotal([loyer, elec], '2026-11-12')).toBe(37_000);
    expect(upcomingEssentials(snap([loyer, elec]))).toBe(37_000);
  });
});
