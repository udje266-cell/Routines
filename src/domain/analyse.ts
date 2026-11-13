import { amortization, DEBT_SERVICE_LIMIT } from './credit';
import { addDays, type CivilDate } from './dates';
import { remainingOf } from './dettes';
import { allPlanned } from './forecast';
import type { Francs } from './money';
import { monthlyFixedTotal } from './recurrence';
import { incomeStats, type Operation } from './revenus';
import type { Snapshot } from './types';

/**
 * Analyse financière : patrimoine net, ratios, dépenses par catégorie et score de santé.
 * Fonctions pures calculées sur l'instantané chargé.
 */

export interface NetWorth {
  /** Portefeuilles du quotidien. */
  liquid: Francs;
  /** Poches d'épargne. */
  savings: Francs;
  /** Ce qu'on me doit (créances ouvertes). */
  receivables: Francs;
  /** Capital restant dû des crédits. */
  loans: Francs;
  /** Dettes envers des proches. */
  personalDebts: Francs;
  assets: Francs;
  liabilities: Francs;
  net: Francs;
}

export function loanRemaining(snap: Snapshot): Francs {
  return (snap.loans ?? []).filter((l) => l.status === 'en_cours').reduce((s, l) => {
    const rows = amortization(l, l.extras);
    const last = rows.filter((r) => l.paid.includes(r.n)).at(-1);
    return s + (last ? last.remaining : Math.max(0, l.principal - l.extras.reduce((a, e) => a + e.amount, 0)));
  }, 0);
}

export function netWorth(snap: Snapshot): NetWorth {
  const liquid = snap.wallets.filter((w) => w.everyday).reduce((s, w) => s + w.balance, 0);
  const savings = snap.wallets.filter((w) => !w.everyday).reduce((s, w) => s + w.balance, 0);
  const debts = snap.debts ?? [];
  const receivables = debts.filter((d) => d.direction === 'on_me_doit').reduce((s, d) => s + remainingOf(d), 0);
  const personalDebts = debts.filter((d) => d.direction === 'je_dois').reduce((s, d) => s + remainingOf(d), 0);
  const loans = loanRemaining(snap);
  const assets = liquid + savings + receivables;
  const liabilities = loans + personalDebts;
  return { liquid, savings, receivables, loans, personalDebts, assets, liabilities, net: assets - liabilities };
}

export interface MonthPoint {
  month: string;
  income: Francs;
  spending: Francs;
  saved: Francs;
}

/** Rentrées, dépenses du quotidien et épargne versée, mois par mois (mois civils, du plus ancien au plus récent). */
export function monthlyHistory(ops: Operation[], pocketIds: string[], today: CivilDate, months = 3): MonthPoint[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const [y, m] = today.split('-').map(Number);
    const k = m - 1 - i;
    const yy = y + Math.floor(k / 12);
    keys.push(`${yy}-${String(((k % 12) + 12) % 12 + 1).padStart(2, '0')}`);
  }
  return keys.map((month) => {
    const mine = ops.filter((o) => o.date.startsWith(month));
    const sum = (xs: Operation[]) => xs.reduce((s, o) => s + o.amount, 0);
    return {
      month,
      income: sum(mine.filter((o) => o.kind === 'rentree' && !o.debtId && !o.loanId)),
      spending: sum(mine.filter((o) => o.kind === 'sortie' && !o.debtId && !o.loanId)) + mine.reduce((s, o) => s + (o.fee ?? 0), 0),
      saved: mine.filter((o) => o.kind === 'transfert' && (pocketIds.includes(o.toWalletId ?? '') || pocketIds.includes(o.walletId)))
        .reduce((s, o) => s + (pocketIds.includes(o.toWalletId ?? '') ? o.amount : -o.amount), 0),
    };
  });
}

export interface CategoryTrend {
  category: string;
  /** Moyenne mensuelle sur les mois précédant le mois en cours. */
  average: Francs;
  current: Francs;
  /** Moyenne des mois précédents à la même date du mois (comparaison à période égale). */
  sameDayAverage: Francs;
  /** Variation du mois en cours par rapport aux mois précédents à la même date. */
  change: number | null;
  share: number;
  /** Nombre de petites dépenses (≤ seuil) ce mois-ci : les « fuites ». */
  smallCount: number;
}

/** Dépenses par catégorie : poids, tendance, petites dépenses répétées. */
export function categoryTrends(ops: Operation[], today: CivilDate, smallThreshold = 3_000): CategoryTrend[] {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8));
  const spends = ops.filter((o) => o.kind === 'sortie' && !o.debtId && !o.loanId && o.date >= addDays(today, -120));
  const total = spends.filter((o) => o.date.startsWith(month)).reduce((s, o) => s + o.amount, 0);
  const cats = [...new Set(spends.map((o) => o.category ?? 'Autre'))];
  return cats.map((category) => {
    const mine = spends.filter((o) => (o.category ?? 'Autre') === category);
    const current = mine.filter((o) => o.date.startsWith(month)).reduce((s, o) => s + o.amount, 0);
    const past = mine.filter((o) => !o.date.startsWith(month));
    const pastMonths = new Set(past.map((o) => o.date.slice(0, 7))).size;
    const average = pastMonths ? Math.round(past.reduce((s, o) => s + o.amount, 0) / pastMonths) : 0;
    const sameDay = pastMonths ? Math.round(past.filter((o) => Number(o.date.slice(8)) <= day).reduce((s, o) => s + o.amount, 0) / pastMonths) : 0;
    return {
      category, average, current, sameDayAverage: sameDay,
      change: sameDay ? current / sameDay - 1 : null,
      share: total ? current / total : 0,
      smallCount: mine.filter((o) => o.date.startsWith(month) && o.amount <= smallThreshold).length,
    };
  }).sort((a, b) => b.current - a.current);
}

/** Dépenses inhabituelles : plus de 2,5 fois la dépense médiane de leur catégorie (au moins 5 points de comparaison). */
export function unusualSpends(ops: Operation[], today: CivilDate): Operation[] {
  const spends = ops.filter((o) => o.kind === 'sortie' && !o.debtId && !o.loanId && o.date >= addDays(today, -120));
  return spends.filter((o) => {
    if (o.date < addDays(today, -30)) return false;
    const same = spends.filter((x) => x.id !== o.id && (x.category ?? 'Autre') === (o.category ?? 'Autre')).map((x) => x.amount).sort((a, b) => a - b);
    if (same.length < 5) return false;
    const mid = Math.floor(same.length / 2);
    const median = same.length % 2 ? same[mid] : (same[mid - 1] + same[mid]) / 2;
    return o.amount > median * 2.5;
  });
}

export interface Ratios {
  /** Revenu moyen mensuel (principal + petites rentrées). */
  income: Francs;
  mainIncome: Francs;
  smallIncome: Francs;
  /** Épargne réellement versée / revenu. */
  savingsRate: number;
  /** Mensualités de crédit / revenu principal. */
  debtService: number;
  /** Mois de charges fixes couverts par l'épargne. */
  emergencyMonths: number;
  /** Charges fixes mensuelles / revenu. */
  fixedShare: number;
  /** Part des petites rentrées dans le revenu. */
  smallShare: number;
  fixedCharges: Francs;
  loanPayments: Francs;
}

export function ratios(snap: Snapshot): Ratios {
  const st = incomeStats(snap.operations ?? [], snap.today, snap.today);
  const income = st.mainMonthly + st.smallMonthly;
  const pockets = snap.wallets.filter((w) => !w.everyday).map((w) => w.id);
  const hist = monthlyHistory(snap.operations ?? [], pockets, snap.today, 3).filter((m) => m.income > 0 || m.spending > 0);
  const saved = hist.length ? hist.reduce((s, m) => s + m.saved, 0) / hist.length : 0;
  const loanPayments = (snap.loans ?? []).filter((l) => l.status === 'en_cours').reduce((s, l) => {
    const next = amortization(l, l.extras).find((r) => !l.paid.includes(r.n));
    return s + (next ? next.payment + next.insurance : 0);
  }, 0);
  const end = addDays(snap.today, 29);
  const oneOff = snap.planned.filter((p) => p.kind === 'sortie' && p.date >= snap.today && p.date <= end).reduce((s, p) => s + p.amount, 0);
  const fixedCharges = monthlyFixedTotal(snap.recurring ?? [], snap.today) + loanPayments + oneOff;
  const savings = snap.wallets.filter((w) => !w.everyday).reduce((s, w) => s + w.balance, 0);
  return {
    income, mainIncome: st.mainMonthly, smallIncome: st.smallMonthly,
    savingsRate: income ? saved / income : 0,
    debtService: st.mainMonthly ? loanPayments / st.mainMonthly : loanPayments ? Infinity : 0,
    emergencyMonths: fixedCharges ? savings / fixedCharges : savings > 0 ? Infinity : 0,
    fixedShare: income ? fixedCharges / income : 0,
    smallShare: income ? st.smallMonthly / income : 0,
    fixedCharges, loanPayments,
  };
}

export interface HealthPillar {
  key: 'epargne' | 'endettement' | 'securite' | 'charges' | 'previsibilite';
  label: string;
  /** 0 à 20 points. */
  score: number;
  status: 'ok' | 'attention' | 'risque';
  detail: string;
}

export interface Health {
  /** Sur 100. */
  score: number;
  grade: 'Solide' | 'Correcte' | 'Fragile' | 'Critique';
  pillars: HealthPillar[];
}

const clamp = (x: number) => Math.max(0, Math.min(20, Math.round(x)));
const pctTxt = (x: number) => `${Math.round(x * 100)} %`;
const status = (s: number): HealthPillar['status'] => (s >= 14 ? 'ok' : s >= 8 ? 'attention' : 'risque');

/** Score de santé financière sur 100, cinq piliers de 20 points, chacun expliqué. */
export function financialHealth(snap: Snapshot): Health {
  const r = ratios(snap);
  const pillars: HealthPillar[] = [];
  const add = (key: HealthPillar['key'], label: string, score: number, detail: string) =>
    pillars.push({ key, label, score: clamp(score), status: status(clamp(score)), detail });

  add('epargne', 'Épargne', (r.savingsRate / 0.2) * 20,
    `Vous épargnez ${pctTxt(r.savingsRate)} de vos rentrées (objectif : 20 %).`);
  add('endettement', 'Endettement', r.debtService === 0 ? 20 : ((DEBT_SERVICE_LIMIT - Math.min(r.debtService, DEBT_SERVICE_LIMIT)) / DEBT_SERVICE_LIMIT) * 20,
    r.debtService === 0 ? 'Aucun crédit en cours.' : `Vos crédits absorbent ${pctTxt(r.debtService)} de votre revenu principal (repère : un tiers au plus).`);
  add('securite', 'Fonds d’urgence', (Math.min(r.emergencyMonths, 3) / 3) * 20,
    Number.isFinite(r.emergencyMonths) ? `Votre épargne couvre ${r.emergencyMonths.toFixed(1).replace('.', ',')} mois de charges fixes (objectif : 3).` : 'Aucune charge fixe enregistrée.');
  add('charges', 'Charges fixes', r.income ? ((0.7 - Math.min(r.fixedShare, 0.7)) / 0.2) * 20 : 0,
    r.income ? `Vos charges fixes prennent ${pctTxt(r.fixedShare)} de vos rentrées (confortable sous 50 %).` : 'Enregistrez vos revenus pour mesurer ce point.');
  add('previsibilite', 'Prévisibilité des rentrées', ((0.8 - Math.min(r.smallShare, 0.8)) / 0.5) * 20,
    `${pctTxt(r.smallShare)} de vos rentrées arrivent en petites sommes, plus difficiles à suivre.`);

  const score = pillars.reduce((s, p) => s + p.score, 0);
  return { score, grade: score >= 75 ? 'Solide' : score >= 55 ? 'Correcte' : score >= 35 ? 'Fragile' : 'Critique', pillars };
}

/** Charges prévues sur 30 jours, toutes sources (pour les conseils). */
export function plannedOutflows30(snap: Snapshot): Francs {
  const end = addDays(snap.today, 29);
  return allPlanned(snap).filter((p) => p.kind !== 'rentree' && p.date <= end).reduce((s, p) => s + p.amount, 0);
}
