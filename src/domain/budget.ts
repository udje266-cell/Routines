import { addDays, type CivilDate } from './dates';
import { forecast, type Forecast } from './forecast';
import type { Francs } from './money';
import type { PlannedItem, Snapshot } from './types';

/**
 * Le budget du jour, unique pour toute l'application (accueil, plan du mois, Agenda, conseiller).
 *
 * On part de la prévision jusqu'à la fin du mois (factures, dettes datées, crédits, argent attendu sûr,
 * versements d'épargne prévus) et on y ajoute ce qu'il faut garder :
 * - la part des dettes sans date ou dues plus tard (aujourd'hui) ;
 * - l'épargne conseillée (le jour où l'argent arrive) ;
 * - les sorties du début du mois suivant, avant la paie (le dernier jour).
 * Puis on cherche, période par période, la plus grande somme dépensable chaque jour sans jamais passer sous zéro.
 */

export interface BudgetSegment {
  from: CivilDate;
  until: CivilDate;
  perDay: Francs;
}

export interface DailyBudget {
  /** À dépenser au plus aujourd'hui. */
  today: Francs;
  /** Les périodes jusqu'à la fin du mois (au plus 3, fusionnées si même montant). */
  segments: BudgetSegment[];
  /** Le plus gros manque d'ici la fin du mois (réserves comprises, épargne conseillée exclue). */
  shortage: { amount: Francs; date: CivilDate } | null;
  /** Vrai si les versements d'épargne prévus sont suspendus ce mois-ci parce que l'argent manque. */
  savingsPaused: boolean;
  /** Épargne conseillée en plus des versements déjà prévus, et quand. */
  save: Francs;
  saveOn: CivilDate;
  /** Réserves gardées. */
  reserves: { debts: Francs; nextMonth: Francs };
  end: CivilDate;
}

const days = (a: CivilDate, b: CivilDate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

/** Plus bas total prévu (départ compris) d'ici `end`, et le premier jour où il passe sous zéro. */
function lowest(fc: Forecast, end: CivilDate, from?: CivilDate) {
  let low = from ? Infinity : fc.start.total;
  let firstNeg: CivilDate | null = !from && fc.start.total < 0 ? fc.from : null;
  let prev = fc.start.total;
  for (const e of fc.events) {
    if (e.date > end) break;
    if (!from || e.date >= from) {
      low = Math.min(low, e.total);
      if (e.total < 0) firstNeg ??= e.date;
    }
    prev = e.total;
  }
  if (low === Infinity) low = prev;
  return { low, firstNeg };
}

/** Découpe en périodes : chaque jour la même somme, sans qu'aucun moment ne passe sous zéro. */
export function segmentsOf(fc: Forecast, today: CivilDate, end: CivilDate): BudgetSegment[] {
  const pts = fc.events.filter((e) => e.date <= end);
  const out: BudgetSegment[] = [];
  let start = today;
  let spent = 0;
  let i0 = 0;
  let guard = 0;
  while (start <= end && guard++ < 400) {
    let best = Infinity;
    let until = end;
    let next = pts.length;
    let prev = i0 === 0 ? fc.start.total : pts[i0 - 1].total;
    for (let j = i0; j < pts.length; j++) {
      const e = pts[j];
      const income = e.item.kind === 'rentree';
      const n = income ? days(start, e.date) - 1 : days(start, e.date);
      const funds = (income ? prev : e.total) - spent;
      if (n > 0 && funds / n < best) {
        best = funds / n;
        until = income ? addDays(e.date, -1) : e.date;
        next = j + 1;
      }
      prev = e.total;
    }
    const nEnd = days(start, end);
    const last = (pts.length ? pts[pts.length - 1].total : fc.start.total) - spent;
    if (last / nEnd <= best) {
      best = last / nEnd;
      until = end;
      next = pts.length;
    }
    const perDay = Math.max(0, Math.floor(best));
    const prevSeg = out[out.length - 1];
    if (prevSeg && prevSeg.perDay === perDay) prevSeg.until = until;
    else out.push({ from: start, until, perDay });
    spent += perDay * days(start, until);
    start = addDays(until, 1);
    i0 = next;
    while (i0 < pts.length && pts[i0].date < start) i0++;
  }
  return out;
}

export interface BudgetInput {
  end: CivilDate;
  /** Épargne conseillée du mois (avant déduction des versements déjà prévus). */
  recommended: Francs;
  /** Part des dettes à garder (hors dettes déjà datées dans la prévision). */
  debtReserve: Francs;
  /** À garder pour le début du mois suivant. */
  nextMonth: Francs;
  /** Jour où l'argent principal du mois arrive (pour l'épargne). */
  saveOn: CivilDate;
  /** L'entrée qui finance l'épargne ce jour-là (elle passe alors après cette entrée). */
  saveFundedBy?: string;
}

export function dailyBudget(snap: Snapshot, input: BudgetInput): DailyBudget {
  const { end, saveOn } = input;
  const wallet = snap.wallets.find((w) => w.everyday)?.id ?? snap.wallets[0]?.id ?? '';
  const reserve = (id: string, label: string, amount: Francs, date: CivilDate): PlannedItem[] =>
    amount > 0 ? [{ id: `reserve-${id}`, kind: 'sortie', label, amount, date, walletId: wallet }] : [];
  const reserves = [
    ...reserve('dettes', 'Part des dettes', input.debtReserve, snap.today),
    ...reserve('mois-suivant', 'Début du mois suivant', input.nextMonth, end),
  ];

  // Si l'argent manque même sans épargne programmée, les versements prévus du mois sont suspendus.
  const noGoals: Snapshot = { ...snap, goals: (snap.goals ?? []).map((g) => ({ ...g, fromWalletId: undefined })) };
  const withGoals = forecast(snap, 'standard', reserves, 70);
  const lowWith = lowest(withGoals, end);
  const paused = lowWith.low < 0 && (snap.goals ?? []).some((g) => g.status === 'actif' && g.fromWalletId);
  const base = paused ? noGoals : snap;
  const fc = paused ? forecast(noGoals, 'standard', reserves, 70) : withGoals;
  const l = paused ? lowest(fc, end) : lowWith;
  const shortage = l.low < 0 ? { amount: -l.low, date: l.firstNeg ?? snap.today } : null;

  // Épargne conseillée : en plus des versements déjà prévus, et seulement ce qui reste libre à partir du jour choisi.
  const planned = fc.events.filter((e) => e.date <= end && e.item.source === 'epargne').reduce((s, e) => s + e.item.amount, 0);
  const freeAfter = shortage ? 0 : Math.max(0, lowest(fc, end, saveOn).low);
  const save = Math.max(0, Math.min(input.recommended - planned, freeAfter));

  const saving = reserve('epargne', 'Épargne conseillée', save, saveOn).map((x) => ({ ...x, fundedByIncomeId: input.saveFundedBy }));
  const final = save > 0 ? forecast(base, 'standard', [...reserves, ...saving], 70) : fc;
  const segments = segmentsOf(final, snap.today, end);
  return {
    today: segments[0]?.perDay ?? 0, segments, shortage, savingsPaused: paused, save, saveOn,
    reserves: { debts: input.debtReserve, nextMonth: input.nextMonth }, end,
  };
}
