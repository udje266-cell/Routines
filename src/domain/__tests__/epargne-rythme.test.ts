/// <reference types="jest" />
import { adviseSavings, simulateScenario, spendingPace, type CashFlow } from '..';

describe('Épargne recommandée', () => {
  it('sans objectif : ajoute un fonds d’urgence et vise 20 %', () => {
    const a = adviseSavings({ today: '2026-11-12', income: 120_000, smallIncome: 0, essentials: 60_000, goals: [] });
    expect(a.addedDefaultGoal?.target).toBe(180_000);
    expect(a.recommended).toBe(24_000); // 20 % > 15 000 F/mois du fonds sur 12 mois
    expect(a.leftToLive).toBe(36_000);
  });

  it('compte les petites rentrées et propose d’en épargner 30 %', () => {
    const a = adviseSavings({ today: '2026-11-12', income: 120_000, smallIncome: 230_000, essentials: 60_000, goals: [] });
    expect(a.recommended).toBe(70_000);
    expect(a.smallIncomeRule.monthly).toBe(69_000);
  });

  it('objectif trop ambitieux : plafonne à la capacité et repousse la date', () => {
    const a = adviseSavings({
      today: '2026-11-12', income: 120_000, essentials: 100_000,
      goals: [{ id: 'g', name: 'Moto', target: 600_000, saved: 0, date: '2027-05-12' }],
    });
    expect(a.recommended).toBe(20_000);
    expect(a.plans[0].suggestedDate).toBe('2029-05-12');
  });
});

describe('Petites coupures et rythme', () => {
  // 120 000 F de salaire, 15 jours écoulés, déjà 175 000 F dépensés : rythme ~350 000 F/mois.
  const spends: CashFlow[] = Array.from({ length: 15 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, amount: 11_667 }));
  const extras: CashFlow[] = Array.from({ length: 12 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, amount: 5_000 }));
  const r = spendingPace({ today: '2026-11-15', cycleStart: '2026-11-01', cycleEnd: '2026-11-30', plannedSpend: 90_000, spends, extraIncomes: extras });

  it('détecte le dérapage et projette la fin de mois', () => {
    expect(r.status).toBe('derapage');
    expect(r.projectedSpend).toBe(350_010);
    expect(r.dailyAllowance).toBe(0);
  });
  it('rend visibles les petites sommes reçues', () => {
    expect(r.smallIncome).toEqual({ count: 12, total: 60_000 });
  });
});

it('scénario : épargne cumulée et découvert', () => {
  const m = simulateScenario({ months: 6, income: 120_000, smallIncome: 200_000, essentials: 60_000, dailySpend: 6_000, savingsRate: 0.2 });
  expect(m[5].cumulativeSavings).toBe(384_000);
  expect(m[0].balance).toBe(320_000 - 240_000 - 64_000);
});
