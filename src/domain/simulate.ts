import { addDays, type CivilDate } from './dates';
import { dailyMinimum, forecast, type Forecast } from './forecast';
import type { Francs } from './money';
import { undatedDebtsOf } from './dettes';
import type { PlannedItem, Snapshot, UndatedDebt } from './types';

export interface PurchaseInput {
  amount: Francs;
  category: string;
  walletId: string;
  date: CivilDate;
  label?: string;
}

export interface Shortfall {
  /** Première date où l'achat crée ou aggrave un manque. */
  date: CivilDate;
  /** Manque provoqué par l'achat à cette date. */
  caused: Francs;
  /** Déficit déjà prévu sans l'achat à cette date. */
  preexisting: Francs;
  /** Première échéance compromise (ou l'achat lui-même si le solde ne suffit pas le jour même). */
  item: PlannedItem;
  scope: 'portefeuille' | 'total';
}

export interface SimulationResult {
  verdict: 'ok' | 'risque' | 'depend_rentree';
  /** Manque dans la vue standard (le plus tôt entre portefeuille et total). */
  shortfall: Shortfall | null;
  /** Si la vue standard passe mais la vue prudente non : rentrées dont l'achat dépend. */
  dependsOn: { shortfall: Shortfall; incomes: PlannedItem[] } | null;
  categoryOverrun: { category: string; cap: Francs; over: Francs } | null;
  /** Première autre date compatible dans l'horizon, null si aucune. */
  alternativeDate: CivilDate | null;
  undatedDebts: UndatedDebt[];
  /** Vrai si un déficit existe déjà sans l'achat dans l'horizon. */
  preexistingDeficit: boolean;
}

export const PURCHASE_ID = '__achat_simule__';

export function purchaseItem(p: PurchaseInput): PlannedItem {
  return {
    id: PURCHASE_ID,
    kind: 'sortie',
    label: p.label ?? 'Achat testé',
    amount: p.amount,
    date: p.date,
    walletId: p.walletId,
    category: p.category,
    source: 'achat',
  };
}

function firstAddedShortfall(base: Forecast, scen: Forecast, key: string): Shortfall | null {
  const mb = dailyMinimum(base, key);
  const ms = dailyMinimum(scen, key);
  for (const [date, s] of ms) {
    const b = mb.get(date) ?? 0;
    const defS = Math.max(0, -s);
    const defB = Math.max(0, -b);
    if (defS > defB) {
      const bal = (e: (typeof scen.events)[number]) => (key === '*' ? e.total : e.balances[key] ?? 0);
      const item =
        scen.events.find((e) => e.date === date && bal(e) < Math.min(0, b))?.item ??
        scen.events.find((e) => e.date === date && e.item.id === PURCHASE_ID)?.item ??
        scen.events.find((e) => e.date === date)!.item;
      return { date, caused: defS - defB, preexisting: defB, item, scope: key === '*' ? 'total' : 'portefeuille' };
    }
  }
  return null;
}

function check(snap: Snapshot, view: 'standard' | 'prudente', p: PurchaseInput): Shortfall | null {
  if (p.date < snap.today) throw new Error("La date d'achat est passée.");
  const base = forecast(snap, view);
  const scen = forecast(snap, view, [purchaseItem(p)]);
  const w = firstAddedShortfall(base, scen, p.walletId);
  const wallet = snap.wallets.find((x) => x.id === p.walletId);
  const t = wallet?.everyday ? firstAddedShortfall(base, scen, '*') : null;
  if (!w) return t;
  if (!t) return w;
  return t.date < w.date ? t : w;
}

/** Teste un achat sans créer d'opération : compare plan actuel et scénario jusqu'à la fin de l'horizon. */
export function simulatePurchase(snap: Snapshot, p: PurchaseInput): SimulationResult {
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error('Montant invalide.');
  if (!snap.wallets.some((w) => w.id === p.walletId)) throw new Error('Portefeuille inconnu.');

  const shortfall = check(snap, 'standard', p);
  let dependsOn: SimulationResult['dependsOn'] = null;
  if (!shortfall) {
    const prudent = check(snap, 'prudente', p);
    if (prudent) {
      const std = forecast(snap, 'standard');
      const incomes = std.events
        .filter((e) => e.item.kind === 'rentree' && e.date <= prudent.date)
        .map((e) => e.item);
      dependsOn = { shortfall: prudent, incomes };
    }
  }

  const b = snap.budgets?.find((x) => x.category === p.category);
  const over = b ? b.spent + p.amount - b.cap : 0;
  const categoryOverrun = b && over > 0 ? { category: b.category, cap: b.cap, over } : null;

  let alternativeDate: CivilDate | null = null;
  if (shortfall) {
    const end = forecast(snap, 'standard').to;
    for (let d = addDays(p.date, 1); d <= end; d = addDays(d, 1)) {
      if (!check(snap, 'standard', { ...p, date: d })) {
        alternativeDate = d;
        break;
      }
    }
  }

  const baseStd = forecast(snap, 'standard');
  const preexistingDeficit =
    baseStd.start.total < 0 || baseStd.events.some((e) => Object.values(e.balances).some((v) => v < 0));

  return {
    verdict: shortfall ? 'risque' : dependsOn ? 'depend_rentree' : 'ok',
    shortfall,
    dependsOn,
    categoryOverrun,
    alternativeDate,
    undatedDebts: [...(snap.undatedDebts ?? []), ...undatedDebtsOf(snap.debts ?? [])],
    preexistingDeficit,
  };
}
