import { addDays, type CivilDate, monthlyDate } from './dates';
import type { Francs } from './money';
import type { Operation } from './revenus';

export interface CycleSettings {
  /** Jour de début du cycle mensuel (1-31), ramené au dernier jour d'un mois court. */
  startDay: number;
  /** Mode à dates libres (revenus irréguliers) : prochain début choisi à la main. */
  freeNextStart?: CivilDate;
  freeStart?: CivilDate;
}

export interface CycleBounds {
  start: CivilDate;
  /** Dernier jour du cycle (veille du prochain début). */
  end: CivilDate;
}

/** Bornes du cycle contenant `today`. */
export function cycleBounds(today: CivilDate, s: CycleSettings): CycleBounds {
  if (s.freeStart && s.freeNextStart && s.freeStart <= today && today < s.freeNextStart)
    return { start: s.freeStart, end: addDays(s.freeNextStart, -1) };
  const [y, m] = today.split('-').map(Number);
  const thisMonth = monthlyDate(y, m, s.startDay);
  const prev = (yy: number, mm: number) => (mm === 1 ? [yy - 1, 12] : [yy, mm - 1]);
  const next = (yy: number, mm: number) => (mm === 12 ? [yy + 1, 1] : [yy, mm + 1]);
  if (today >= thisMonth) {
    const [ny, nm] = next(y, m);
    return { start: thisMonth, end: addDays(monthlyDate(ny, nm, s.startDay), -1) };
  }
  const [py, pm] = prev(y, m);
  return { start: monthlyDate(py, pm, s.startDay), end: addDays(thisMonth, -1) };
}

/** Jour du cycle (1 = premier jour), à la manière d'un suivi de cycle. */
export function cycleDay(today: CivilDate, b: CycleBounds): { day: number; length: number } {
  const d = (a: CivilDate, z: CivilDate) => Math.round((Date.parse(z) - Date.parse(a)) / 86_400_000);
  return { day: d(b.start, today) + 1, length: d(b.start, b.end) + 1 };
}

export interface CategoryCap {
  category: string;
  cap: Francs;
  /** Enveloppe « plaisir » (sorties, jeux, achats en ligne…). */
  pleasure: boolean;
}

export interface CategoryStatus extends CategoryCap {
  spent: Francs;
  left: Francs;
  status: 'ok' | 'presque' | 'depasse';
}

/** Dépenses réelles du cycle par catégorie, comparées aux plafonds. */
export function categoryStatus(caps: CategoryCap[], ops: Operation[], b: CycleBounds): CategoryStatus[] {
  return caps.map((c) => {
    const spent = ops
      .filter((o) => o.kind === 'sortie' && !o.debtId && o.category === c.category && o.date >= b.start && o.date <= b.end)
      .reduce((s, o) => s + o.amount, 0);
    const left = c.cap - spent;
    return { ...c, spent, left, status: left < 0 ? 'depasse' : spent >= c.cap * 0.8 ? 'presque' : 'ok' };
  });
}

export interface IntentRecord {
  id: string;
  amount: Francs;
  category: string;
  walletId: string;
  date: CivilDate;
  status: 'en_pause' | 'achete' | 'abandonne' | 'replanifie';
  createdOn: CivilDate;
}

export interface CycleReview {
  bounds: CycleBounds;
  income: { main: Francs; small: Francs };
  spending: Francs;
  categories: CategoryStatus[];
  pleasure: { cap: Francs; spent: Francs };
  debtsPaid: Francs;
  debtsReceived: Francs;
  /** Épargne réellement versée (nette des retraits). */
  saved: Francs;
  /** Achats abandonnés : affichés à part, jamais comptés comme épargne. */
  abandoned: { count: number; total: Francs };
}

/** Bilan de cycle : prévu (plafonds) contre réel. */
export function cycleReview(
  caps: CategoryCap[], ops: Operation[], intents: IntentRecord[], b: CycleBounds, pocketIds: string[],
): CycleReview {
  const inC = (o: { date: CivilDate }) => o.date >= b.start && o.date <= b.end;
  const cyc = ops.filter(inC);
  const sum = (xs: Operation[]) => xs.reduce((s, o) => s + o.amount, 0);
  const cats = categoryStatus(caps, ops, b);
  const pl = cats.filter((c) => c.pleasure);
  const ab = intents.filter((i) => i.status === 'abandonne' && i.createdOn >= b.start && i.createdOn <= b.end);
  return {
    bounds: b,
    income: {
      main: sum(cyc.filter((o) => o.kind === 'rentree' && !o.debtId && o.incomeType !== 'petite')),
      small: sum(cyc.filter((o) => o.kind === 'rentree' && o.incomeType === 'petite')),
    },
    spending: sum(cyc.filter((o) => o.kind === 'sortie' && !o.debtId)) + cyc.reduce((s, o) => s + (o.fee ?? 0), 0),
    categories: cats,
    pleasure: { cap: pl.reduce((s, c) => s + c.cap, 0), spent: pl.reduce((s, c) => s + c.spent, 0) },
    debtsPaid: sum(cyc.filter((o) => o.debtId && o.kind === 'sortie')),
    debtsReceived: sum(cyc.filter((o) => o.debtId && o.kind === 'rentree')),
    saved: cyc.filter((o) => o.kind === 'transfert' && (pocketIds.includes(o.toWalletId ?? '') || pocketIds.includes(o.walletId)))
      .reduce((s, o) => s + (pocketIds.includes(o.toWalletId ?? '') ? o.amount : -o.amount), 0),
    abandoned: { count: ab.length, total: ab.reduce((s, i) => s + i.amount, 0) },
  };
}

/** Cycle courant de l'utilisateur (mensuel au 1er par défaut). */
export function currentCycle(snap: { today: CivilDate; cycle?: CycleSettings }): CycleBounds {
  return cycleBounds(snap.today, snap.cycle ?? { startDay: 1 });
}
