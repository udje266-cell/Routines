/// <reference types="jest" />
import { goalSchedule, parseFcfa, spendingPace, unusualSpends, type Operation } from '..';

it('échéancier : jamais de versement nul ou négatif, total exact', () => {
  const g = { id: 'g', name: 'Petit', target: 10, date: '2027-06-10', pocketWalletId: 'p', plannedDay: 5, status: 'actif' as const, movements: [] };
  const s = goalSchedule(g, '2026-11-13');
  expect(s.installments.every((i) => i.amount > 0)).toBe(true);
  expect(s.installments.reduce((t, i) => t + i.amount, 0)).toBe(10);
});

it('rythme : aujourd’hui compte comme un jour restant', () => {
  const r = spendingPace({ today: '2026-11-30', cycleStart: '2026-11-01', cycleEnd: '2026-11-30', plannedSpend: 30_000, spends: [], extraIncomes: [] });
  expect(r.daysLeft).toBe(1);
  expect(r.dailyAllowance).toBe(30_000);
});

it('dépenses inhabituelles : médiane correcte avec un nombre pair de points', () => {
  const op = (id: string, amount: number, date: string): Operation => ({ id, kind: 'sortie', walletId: 'w', amount, date, label: '', category: 'Sorties' });
  const ops = [1000, 1000, 1000, 9000, 9000, 9000].map((a, i) => op(`o${i}`, a, '2026-09-1' + i));
  // Médiane 5 000 → seuil 12 500 : 15 000 est inhabituel (avec l'ancienne médiane 9 000, il passait inaperçu).
  expect(unusualSpends([...ops, op('x', 15_000, '2026-11-10')], '2026-11-13').map((o) => o.id)).toEqual(['x']);
});

it('montant saisi : le point n’est qu’un séparateur de milliers', () => {
  expect(parseFcfa('30.000')).toBe(30_000);
  expect(parseFcfa('1.5')).toBeNull();
  expect(parseFcfa('30 000 F')).toBe(30_000);
  expect(parseFcfa('12 500 FCFA')).toBe(12_500);
});
