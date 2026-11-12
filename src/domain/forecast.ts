import { addDays, type CivilDate } from './dates';
import type { Francs } from './money';
import { debtsToPlanned } from './dettes';
import { goalsToPlanned } from './objectifs';
import type { ForecastView, PlannedItem, Snapshot, Wallet } from './types';

/** Toutes les échéances : saisies, dettes datées et versements d'épargne prévus. */
export function allPlanned(snap: Snapshot): PlannedItem[] {
  return [...snap.planned, ...debtsToPlanned(snap.debts ?? []), ...goalsToPlanned(snap.goals ?? [], snap.today)];
}

export const HORIZON_DAYS = 60;

export interface ForecastEvent {
  item: PlannedItem;
  /** Date effective (une sortie échue non réglée est ramenée à aujourd'hui). */
  date: CivilDate;
  overdue: boolean;
  balances: Record<string, Francs>;
  total: Francs;
}

export interface Forecast {
  view: ForecastView;
  from: CivilDate;
  to: CivilDate;
  start: { balances: Record<string, Francs>; total: Francs };
  events: ForecastEvent[];
  /** Rentrées en retard, sorties de la projection jusqu'à confirmation ou replanification. */
  lateIncomes: PlannedItem[];
  /** Rentrées écartées de cette vue (incertaines, ou toutes en vue prudente). */
  excludedIncomes: PlannedItem[];
}

export function totalOf(wallets: Wallet[], balances: Record<string, Francs>): Francs {
  return wallets.filter((w) => w.everyday).reduce((s, w) => s + (balances[w.id] ?? 0), 0);
}

const isOutflow = (i: PlannedItem) => i.kind === 'sortie' || i.kind === 'transfert';

/**
 * Projection sur `horizon` jours à partir de l'état réel.
 * Règles : une rentrée future ne touche jamais le réel ; le même jour, les sorties passent avant
 * les rentrées, sauf sortie explicitement financée par une rentrée du jour en vue standard.
 */
export function forecast(
  snap: Snapshot,
  view: ForecastView = 'standard',
  extra: PlannedItem[] = [],
  horizon: number = HORIZON_DAYS,
): Forecast {
  const from = snap.today;
  const to = addDays(from, horizon - 1);
  const balances: Record<string, Francs> = {};
  for (const w of snap.wallets) balances[w.id] = w.balance;

  const lateIncomes: PlannedItem[] = [];
  const excludedIncomes: PlannedItem[] = [];
  const kept: { item: PlannedItem; date: CivilDate; overdue: boolean; idx: number }[] = [];

  [...allPlanned(snap), ...extra].forEach((item, idx) => {
    if (item.kind === 'rentree') {
      if (item.date < from) return void lateIncomes.push(item);
      if (view === 'prudente' || item.certainty === 'incertaine') return void excludedIncomes.push(item);
      if (item.date > to) return;
      kept.push({ item, date: item.date, overdue: false, idx });
      return;
    }
    const overdue = item.date < from;
    const date = overdue ? from : item.date;
    if (date > to) return;
    kept.push({ item, date, overdue, idx });
  });

  const includedIncomes = new Set(kept.filter((k) => k.item.kind === 'rentree').map((k) => k.item.id));
  const rank = (k: (typeof kept)[number]) => {
    if (!isOutflow(k.item)) return 1;
    const f = k.item.fundedByIncomeId;
    if (view === 'standard' && f && includedIncomes.has(f)) {
      const inc = kept.find((x) => x.item.id === f);
      if (inc && inc.date === k.date) return 2;
    }
    return 0;
  };
  kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a) - rank(b) || a.idx - b.idx));

  const start = { balances: { ...balances }, total: totalOf(snap.wallets, balances) };
  const events: ForecastEvent[] = kept.map(({ item, date, overdue }) => {
    if (item.kind === 'rentree') balances[item.walletId] = (balances[item.walletId] ?? 0) + item.amount;
    else {
      balances[item.walletId] = (balances[item.walletId] ?? 0) - item.amount;
      if (item.kind === 'transfert' && item.toWalletId)
        balances[item.toWalletId] = (balances[item.toWalletId] ?? 0) + item.amount;
    }
    return { item, date, overdue, balances: { ...balances }, total: totalOf(snap.wallets, balances) };
  });

  return { view, from, to, start, events, lateIncomes, excludedIncomes };
}

/** Solde minimal atteint chaque jour (intra-journalier), pour un portefeuille ou le total ('*'). */
export function dailyMinimum(fc: Forecast, key: string): Map<CivilDate, Francs> {
  const pick = (b: Record<string, Francs>, t: Francs) => (key === '*' ? t : b[key] ?? 0);
  const out = new Map<CivilDate, Francs>();
  let current = pick(fc.start.balances, fc.start.total);
  let ei = 0;
  for (let d = fc.from; d <= fc.to; d = addDays(d, 1)) {
    let min = current;
    while (ei < fc.events.length && fc.events[ei].date === d) {
      current = pick(fc.events[ei].balances, fc.events[ei].total);
      min = Math.min(min, current);
      ei++;
    }
    out.set(d, min);
  }
  return out;
}

export interface Margin {
  /** Plus bas total disponible prévu avant la prochaine rentrée datée (ou sur tout l'horizon). */
  amount: Francs;
  nextIncome: PlannedItem | null;
  /** Vrai si aucune rentrée datée et attendue n'est connue. */
  missingIncomeDate: boolean;
}

/** Marge affichée sur « Aujourd'hui » : jusqu'à la prochaine rentrée datée (vue standard). */
export function marginUntilNextIncome(snap: Snapshot): Margin {
  const fc = forecast(snap, 'standard');
  const idx = fc.events.findIndex((e) => e.item.kind === 'rentree');
  const scope = idx === -1 ? fc.events : fc.events.slice(0, idx);
  const amount = scope.reduce((m, e) => Math.min(m, e.total), fc.start.total);
  return {
    amount,
    nextIncome: idx === -1 ? null : fc.events[idx].item,
    missingIncomeDate: idx === -1,
  };
}

/** Charges des 30 prochains jours (sorties prévues hors épargne) : estimation des charges essentielles du mois. */
export function upcomingEssentials(snap: Snapshot): Francs {
  const end = addDays(snap.today, 29);
  return allPlanned(snap)
    .filter((p) => p.kind === 'sortie' && p.source !== 'achat' && p.date <= end)
    .reduce((s, p) => s + p.amount, 0);
}
