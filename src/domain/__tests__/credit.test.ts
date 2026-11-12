/// <reference types="jest" />
import {
  adviseLoan, amortization, annuityPayment, forecast, loanCost, repaymentStrategy, simulateEarlyRepayment,
  type Loan, type LoanRecord, type Snapshot,
} from '..';

const pret: Loan = {
  id: 'p', label: 'Prêt moto', lenderType: 'banque', principal: 1_000_000, annualRate: 0.12, months: 12,
  firstDueDate: '2026-12-05', method: 'annuite', fees: 0, insuranceMonthly: 0, walletId: 'w',
};

describe('Échéancier', () => {
  it('mensualité constante arrondie au franc supérieur', () => {
    expect(annuityPayment(1_000_000, 0.12, 12)).toBe(88_849);
  });
  it('le capital remboursé égale exactement le montant emprunté', () => {
    const rows = amortization(pret);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ date: '2026-12-05', interest: 10_000, principal: 78_849, remaining: 921_151 });
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(1_000_000);
    expect(rows.at(-1)!.remaining).toBe(0);
    expect(rows[1].date).toBe('2027-01-05');
  });
  it('capital constant : intérêts décroissants', () => {
    const rows = amortization({ ...pret, method: 'capital_constant' });
    expect(rows[0].principal).toBe(83_334);
    expect(rows[0].interest).toBeGreaterThan(rows[11].interest);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(1_000_000);
  });
  it('échéance au 31 : dernier jour des mois courts', () => {
    expect(amortization({ ...pret, firstDueDate: '2027-01-31' }).slice(0, 2).map((r) => r.date)).toEqual(['2027-01-31', '2027-02-28']);
  });
});

describe('Coût et TEG', () => {
  it('sans frais, le TEG est le taux nominal', () => {
    const c = loanCost(pret);
    expect(c.totalInterest).toBe(66_186); // vérifié par un calcul indépendant
    expect(Math.abs(c.teg - 0.12)).toBeLessThan(0.0005);
  });
  it('frais et assurance relèvent le TEG et le coût', () => {
    const c = loanCost({ ...pret, fees: 20_000, insuranceMonthly: 1_500 });
    expect(c.totalCost).toBe(66_186 + 20_000 + 18_000);
    expect(c.teg).toBeGreaterThan(0.16);
  });
});

describe('Conseil avant de signer', () => {
  it('plafond de l’usure : 14 % banque, 24 % microfinance', () => {
    expect(adviseLoan(pret, 400_000).usury).toEqual({ cap: 0.14, above: false });
    const mf = adviseLoan({ ...pret, lenderType: 'microfinance', annualRate: 0.26 }, 400_000);
    expect(mf.usury.above).toBe(true);
    expect(mf.warnings[0]).toMatch(/plafond légal de 24 %/);
  });
  it('capacité : un tiers du revenu principal au plus, crédits existants compris', () => {
    const a = adviseLoan(pret, 120_000, 20_000);
    expect(a.debtService.above).toBe(true);
    expect(a.debtService.maxPayment).toBe(20_000);
    expect(adviseLoan(pret, 400_000).debtService.above).toBe(false);
  });
});

describe('Remboursement anticipé', () => {
  it('réduire la durée : intérêts économisés et mois gagnés', () => {
    const r = simulateEarlyRepayment(pret, { date: '2027-05-01', amount: 200_000 }, { savingsRate: 0.035 });
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.monthsSaved).toBe(2);
    expect(r.worthIt).toBe(true);
  });
  it('réduire la mensualité : même durée, mensualité plus basse', () => {
    const r = simulateEarlyRepayment(pret, { date: '2027-05-01', amount: 200_000 }, { mode: 'mensualite' });
    expect(r.monthsSaved).toBe(0);
    expect(r.newPayment).toBeLessThan(88_849);
  });
  it('indemnité déduite du gain', () => {
    const r = simulateEarlyRepayment(pret, { date: '2027-05-01', amount: 200_000 }, { penaltyRate: 0.03 });
    expect(r.penalty).toBe(6_000);
    expect(r.netGain).toBe(r.interestSaved - 6_000);
  });
});

describe('Plusieurs dettes', () => {
  const dettes = [
    { id: 'mf', label: 'Microfinance', balance: 300_000, annualRate: 0.24, minPayment: 20_000 },
    { id: 'banque', label: 'Banque', balance: 500_000, annualRate: 0.12, minPayment: 30_000 },
    { id: 'koffi', label: 'Koffi', balance: 40_000, annualRate: 0, minPayment: 0 },
  ];
  it('avalanche : dette la plus chère d’abord, moins d’intérêts', () => {
    const av = repaymentStrategy(dettes, 100_000, 'avalanche');
    const bn = repaymentStrategy(dettes, 100_000, 'boule_de_neige');
    expect(av.order[0]).toBe('mf');
    expect(bn.order[0]).toBe('koffi');
    expect(av.totalInterest).toBeLessThan(bn.totalInterest);
  });
  it('budget insuffisant pour les minimums', () => {
    expect(repaymentStrategy(dettes, 40_000, 'avalanche').insufficient).toBe(true);
  });
});

it('les échéances non payées entrent dans la prévision', () => {
  const rec: LoanRecord = { ...pret, paid: [1], extras: [], status: 'en_cours', disbursed: true };
  const snap: Snapshot = { today: '2026-12-01', wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 200_000 }], planned: [], loans: [rec] };
  const ev = forecast(snap).events;
  expect(ev.map((e) => e.date)).toEqual(['2027-01-05']);
  expect(ev[0].item.amount).toBe(88_849);
});
