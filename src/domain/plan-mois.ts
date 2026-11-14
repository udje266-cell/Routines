import { dailyBudget, type DailyBudget } from './budget';
import { adviseSavings } from './epargne';
import { addDays, type CivilDate } from './dates';
import { debtShares, type DebtShare } from './dettes';
import { allPlanned, forecast } from './forecast';
import type { Francs } from './money';
import { progressOf } from './objectifs';
import { incomeStats } from './revenus';
import type { PlannedItem, Snapshot } from './types';

/**
 * Plan du mois : ce que l'on sait des entrées et sorties d'argent du mois, jour par jour,
 * et la recommandation d'épargne qui en découle (combien, quand, comment).
 */

export interface DayEntry {
  id: string;
  label: string;
  amount: Francs;
  kind: 'entree' | 'sortie';
  /** Déjà réalisé (opération enregistrée) ou seulement prévu. */
  done: boolean;
  category?: string;
  planned?: PlannedItem;
}

export interface MonthPlan {
  start: CivilDate;
  end: CivilDate;
  days: Record<CivilDate, DayEntry[]>;
  /** Entrées du mois : déjà reçues + encore attendues (sûres). */
  income: Francs;
  /** Sorties connues du mois (factures, crédits, dépenses déjà faites), hors épargne. */
  expenses: Francs;
  /** Épargne déjà prévue ou versée ce mois-ci. */
  savingsPlanned: Francs;
  /** Part des dettes à rembourser ce mois-ci, au-delà de celles déjà datées dans le mois. */
  debtReserve: Francs;
  /** Dettes datées dans le mois (déjà dans le calendrier), à rembourser ce mois-ci. */
  debtPayments: Francs;
  /** Tout ce qui part en dettes ce mois-ci (datées + part réservée). */
  debtTotal: Francs;
  /** Le détail de cette part, dette par dette. */
  debts: DebtShare[];
  /** Ce qu'il reste une fois tout payé (dettes comprises), avant l'épargne. */
  left: Francs;
  advice: SavingAdvice;
  /** Le budget du jour, partagé par l'accueil et l'Agenda. */
  budget: DailyBudget;
}

export interface SavingAdvice {
  /** Montant à mettre de côté ce mois-ci (0 si rien ne reste). */
  save: Francs;
  /** Quand le faire : le jour de la principale entrée du mois, sinon aujourd'hui. */
  saveOn: CivilDate;
  /** Ce qui reste pour la vie courante après l'épargne, par jour jusqu'à la fin du mois. */
  perDay: Francs;
  /** Les étapes, en langage simple. */
  steps: string[];
  /** Si le mois est déficitaire : de combien. */
  shortBy: Francs;
  /** Manque d'argent avant la prochaine grosse entrée (même si le mois finit en positif). */
  cashGap: { amount: Francs; date: CivilDate } | null;
}

const F = (n: number) => `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;

export function monthBounds(day: CivilDate): { start: CivilDate; end: CivilDate } {
  const [y, m] = day.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
  return { start, end };
}

export function monthPlan(snap: Snapshot, anyDayOfMonth: CivilDate = snap.today): MonthPlan {
  const { start, end } = monthBounds(anyDayOfMonth);
  const days: Record<CivilDate, DayEntry[]> = {};
  const push = (d: CivilDate, e: DayEntry) => ((days[d] ??= []).push(e));
  const pockets = new Set(snap.wallets.filter((w) => !w.everyday).map((w) => w.id));

  // Déjà fait ce mois-ci (jusqu'à aujourd'hui).
  for (const o of snap.operations ?? []) {
    if (o.date < start || o.date > end) continue;
    if (o.kind === 'transfert') {
      if (pockets.has(o.toWalletId ?? '')) push(o.date, { id: o.id, label: o.label || 'Épargne', amount: o.amount, kind: 'sortie', done: true, category: 'Épargne' });
      // Les frais de transfert (Wave, Orange Money…) sont une vraie dépense.
      if (o.fee) push(o.date, { id: `${o.id}-frais`, label: 'Frais de transfert', amount: o.fee, kind: 'sortie', done: true, category: 'Frais' });
      continue;
    }
    push(o.date, { id: o.id, label: o.label || o.category || (o.kind === 'rentree' ? 'Argent reçu' : 'Dépense'), amount: o.amount,
      kind: o.kind === 'rentree' ? 'entree' : 'sortie', done: true, category: o.category });
  }
  // Prévu (factures du mois, crédits, épargne prévue, choses planifiées), à partir d'aujourd'hui.
  for (const p of allPlanned(snap)) {
    const d = p.date < snap.today ? snap.today : p.date;
    if (d < start || d > end || (p.kind === 'rentree' && p.date < snap.today)) continue;
    if (p.kind === 'rentree' && p.certainty === 'incertaine') continue;
    push(d, { id: p.id, label: p.label, amount: p.amount, kind: p.kind === 'rentree' ? 'entree' : 'sortie', done: false, category: p.category ?? (p.source === 'epargne' ? 'Épargne' : undefined), planned: p });
  }

  const all = Object.values(days).flat();
  const isSaving = (e: DayEntry) => e.category === 'Épargne';
  const income = all.filter((e) => e.kind === 'entree').reduce((s, e) => s + e.amount, 0);
  const isDebt = (e: DayEntry) => e.kind === 'sortie' && !e.done && e.planned?.source === 'dette';
  const debtPayments = all.filter(isDebt).reduce((s, e) => s + e.amount, 0);
  // Sorties du mois hors épargne et hors dettes (les dettes ont leur propre ligne).
  const expenses = all.filter((e) => e.kind === 'sortie' && !isSaving(e) && !isDebt(e)).reduce((s, e) => s + e.amount, 0);
  const savingsPlanned = all.filter(isSaving).reduce((s, e) => s + e.amount, 0);

  // Dettes que je dois et qui ne sont pas déjà dans le mois : sans date, sans compte choisi, ou à rembourser plus tard.
  // Le banquier prudent rembourse avant d'épargner : on réserve chaque mois la part nécessaire.
  const alreadyPlanned = new Set(all.filter((e) => e.planned?.source === 'dette').map((e) => e.planned!.id));
  const debts = debtShares(snap.debts ?? [], start, end, (d) => alreadyPlanned.has(`dette-${d.id}`));
  const debtReserve = debts.reduce((s, d) => s + d.thisMonth, 0);
  const debtTotal = debtPayments + debtReserve;
  const left = income - expenses - debtTotal;

  // Combien : la recommandation habituelle (20 % visé, objectifs, capacité), bornée par ce qui reste vraiment ce mois-ci.
  const st = incomeStats(snap.operations ?? [], snap.today, start);
  const rec = adviseSavings({
    today: snap.today, income: Math.max(st.mainMonthly, income), smallIncome: 0, essentials: expenses + debtTotal,
    // Les remboursements de dettes passent avant l'épargne : ils réduisent la capacité d'épargne.
    goals: (snap.goals ?? []).filter((g) => g.status === 'actif').map((g) => ({ id: g.id, name: g.name, target: g.target, saved: progressOf(g), date: g.date })),
  }).recommended;
  // L'argent principal du mois : le salaire s'il tombe dans le mois, sinon la plus grosse entrée attendue.
  const incoming = all.filter((e) => e.kind === 'entree' && !e.done && e.planned);
  const mainIncome = incoming.find((e) => e.planned!.recurring) ?? [...incoming].sort((a, b) => b.amount - a.amount)[0];
  const saveOn = mainIncome?.planned ? (mainIncome.planned.date < snap.today ? snap.today : mainIncome.planned.date) : snap.today;

  // Fin du mois : ce qu'il faut garder pour les sorties du début du mois suivant (avant la paie).
  const current = snap.today.slice(0, 7) === start.slice(0, 7);
  const outlook = current ? monthEndOutlook(snap) : null;
  const keepForNext = outlook ? outlook.earlyNext.total : 0;
  const budget = dailyBudget(snap, { end, recommended: rec, debtReserve, nextMonth: keepForNext, saveOn, saveFundedBy: mainIncome?.planned?.id });
  const { save, shortage } = budget;
  const cashGap: SavingAdvice['cashGap'] = shortage;
  const segs = budget.segments;
  const perDay = segs.length ? segs[segs.length - 1].perDay : 0;
  const spentSoFar = all.filter((e) => e.kind === 'sortie' && e.done && !isSaving(e) && !e.planned).reduce((s, e) => s + e.amount, 0);
  const jm = (d: CivilDate) => `${d.slice(8)}-${d.slice(5, 7)}`;

  const steps: string[] = [];
  if (incoming.length === 0 && expenses === 0 && debtTotal === 0 && all.length === 0) {
    steps.push('Ajoutez votre salaire et vos factures du mois (ou touchez un jour du calendrier) : le plan se remplira tout seul.');
  }
  const debtLines = [
    ...all.filter(isDebt).map((e) => `${e.label.replace(/^Rembourser /, '')} ${F(e.amount)} ${e.planned!.date < snap.today ? '(en retard)' : `le ${jm(e.planned!.date)}`}`),
    ...debts.map((d) => `${d.person} ${F(d.thisMonth)}`),
  ];
  if (debtTotal > 0) steps.push(`Remboursez d’abord vos dettes : ${F(debtTotal)} ce mois-ci (${debtLines.slice(0, 4).join(', ')}${debtLines.length > 4 ? '…' : ''}).`);
  if (shortage) {
    const next = all.filter((e) => e.kind === 'sortie' && !e.done && e.planned && e.planned.source !== 'epargne' && e.planned.date >= shortage.date).sort((a, b) => b.amount - a.amount)[0];
    steps.push(`Attention : à partir du ${jm(shortage.date)}, il vous manquera ${F(shortage.amount)}. Pas d’épargne ce mois-ci${budget.savingsPaused ? ' (versements prévus mis en pause)' : ''}.`);
    steps.push(next
      ? `Demandez à décaler « ${next.label} » (${F(next.amount)}), reportez ce qui peut attendre, et notez chaque petite somme reçue : elle réduit le manque.`
      : 'Reportez ce qui peut attendre et notez chaque petite somme reçue : elle réduit le manque.');
  } else if (left < 0) {
    const biggest = all.filter((e) => e.kind === 'sortie' && !e.done).sort((x, y) => y.amount - x.amount).slice(0, 2);
    steps.push(`Ce mois-ci, vos sorties${debtTotal ? ' et vos dettes' : ''} dépassent vos entrées de ${F(-left)} : vous puisez dans l’argent déjà là, pas d’épargne pour l’instant.`);
    if (biggest.length) steps.push(`Voyez si vous pouvez reporter ou réduire : ${biggest.map((x) => `${x.label} (${F(x.amount)})`).join(', ')}.`);
  } else if (save > 0) {
    steps.push(mainIncome && saveOn > snap.today
      ? `Le ${jm(saveOn)}, quand vous recevez « ${mainIncome.label} », mettez tout de suite ${F(save)} de côté, avant toute dépense.`
      : `Mettez ${F(save)} de côté dès aujourd’hui, avant toute dépense.`);
    if (save < rec - savingsPlanned) steps.push(`L’idéal serait ${F(rec)} : réduisez une dépense pour vous en rapprocher.`);
  } else if (savingsPlanned > 0) {
    steps.push(`Vos versements d’épargne prévus (${F(savingsPlanned)}) suffisent ce mois-ci : faites-les à la date prévue.`);
  } else if (all.length) {
    steps.push('Ce mois-ci, rien ne reste pour l’épargne une fois tout payé : gardez au moins une petite somme de côté chaque semaine, même 1 000 F.');
  }
  // Ce qu'on peut dépenser, période par période (le même calcul que « Je peux dépenser aujourd’hui »).
  if (segs.length > 1) {
    segs.slice(0, 3).forEach((g, k) => steps.push(k === 0
      ? `Jusqu’au ${jm(g.until)} : au plus ${F(g.perDay)} par jour pour vivre (nourriture, transport, sorties).`
      : `Du ${jm(g.from)} au ${jm(g.until)} : au plus ${F(g.perDay)} par jour.`));
  } else if (segs.length === 1) {
    steps.push(`Jusqu’à la fin du mois : au plus ${F(segs[0].perDay)} par jour pour vivre (nourriture, transport, sorties).`);
  }
  if (spentSoFar > 0) steps.push(`Vous avez déjà dépensé ${F(spentSoFar)} au quotidien ce mois-ci.`);
  if (outlook && keepForNext > 0) {
    steps.push(`Gardez ${F(keepForNext)} pour le début du mois prochain (${outlook.earlyNext.items.slice(0, 2).map((i) => i.label).join(', ')}) : ce montant est déjà retiré de vos limites par jour.`);
  }

  return { start, end, days, income, expenses, savingsPlanned, debtReserve, debtPayments, debtTotal, debts, left, budget,
    advice: { save, saveOn, perDay, steps, shortBy: Math.max(0, -left), cashGap } };
}

export interface MonthEndOutlook {
  /** Dernier jour du mois en cours. */
  end: CivilDate;
  /** Ce que vous aurez en tout ce jour-là (comptes du quotidien et épargne), d'après les prévisions. */
  endBalance: Francs;
  /** Le plus bas d'ici la fin du mois. */
  lowest: { date: CivilDate; total: Francs } | null;
  /** Ce qui est à payer au début du mois suivant, avant la paie (ou jusqu'au 15 sans paie connue). */
  earlyNext: { until: CivilDate; items: PlannedItem[]; total: Francs; payday: PlannedItem | null };
  /** Ce qui reste vraiment une fois ces sorties du début de mois mises de côté. */
  free: Francs;
}

/**
 * Prévision arrêtée à la fin du mois : combien vous aurez ce jour-là, puis ce qu'il faut garder pour les
 * sorties du début du mois suivant (avant la paie), et ce qui reste vraiment.
 */
export function monthEndOutlook(snap: Snapshot, view: 'standard' | 'prudente' = 'standard'): MonthEndOutlook {
  const { end } = monthBounds(snap.today);
  const fc = forecast(snap, view);
  const inMonth = fc.events.filter((e) => e.date <= end);
  const endBalance = inMonth.length ? inMonth[inMonth.length - 1].total : fc.start.total;
  const lowest = inMonth.reduce<{ date: CivilDate; total: Francs } | null>((lo, e) => (!lo || e.total < lo.total ? { date: e.date, total: e.total } : lo), null);

  const nextStart = addDays(end, 1);
  const nextEnd = monthBounds(nextStart).end;
  const after = fc.events.filter((e) => e.date >= nextStart && e.date <= nextEnd);
  const payday = after.find((e) => e.item.kind === 'rentree' && !!e.item.recurring)?.item ?? null;
  // Le jour de paie compris : ce jour-là, les sorties passent avant l'arrivée du salaire.
  const until = payday ? payday.date : `${nextStart.slice(0, 8)}15`;
  const items = after.filter((e) => e.item.kind === 'sortie' && e.date <= until).map((e) => e.item);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return { end, endBalance, lowest, earlyNext: { until, items, total, payday }, free: endBalance - total };
}
