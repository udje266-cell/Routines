import { categoryTrends, financialHealth, loanRemaining, ratios } from './analyse';
import { amortization, simulateEarlyRepayment, USURY_CAPS } from './credit';
import { currentCycle, categoryStatus } from './cycle';
import { formatDateFr } from './dates';
import { dailyMinimum, forecast } from './forecast';
import { formatFcfa, type Francs } from './money';
import { goalSchedule } from './objectifs';
import { PLACEMENTS, futureValue } from './placements';
import { incomeStats } from './revenus';
import { spendingPace } from './rythme';
import type { Snapshot } from './types';

/**
 * Le conseiller : recommandations classées par priorité, chacune chiffrée et reliée à une action.
 * Ordre de priorité d'un banquier prudent : payer ce qui est dû → sécurité (fonds d'urgence) →
 * dettes chères → maîtrise des dépenses → faire fructifier l'épargne.
 */

export type Route = '/calendrier' | '/credits' | '/epargne' | '/enveloppes' | '/mon-budget' | '/tester-achat' | '/depenses-mensuelles' | '/analyste' | '/';

export interface Advice {
  id: string;
  /** 1 = urgent, 2 = important, 3 = opportunité. */
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  /** Effet chiffré de l'action (économie, manque évité, gain), si mesurable. */
  impact?: { label: string; amount: Francs };
  action?: { label: string; href: Route };
}

export function advise(snap: Snapshot): Advice[] {
  const out: Advice[] = [];
  const fc = forecast(snap);
  const r = ratios(snap);
  const savings = snap.wallets.filter((w) => !w.everyday).reduce((s, w) => s + w.balance, 0);

  // 1. Payer ce qui est dû.
  const overdue = fc.events.filter((e) => e.overdue);
  if (overdue.length)
    out.push({
      id: 'retard', priority: 1, title: `${overdue.length} échéance${overdue.length > 1 ? 's' : ''} en retard`,
      detail: `${overdue.map((e) => `${e.item.label} (${formatFcfa(e.item.amount)})`).join(', ')} : à régler aujourd’hui pour éviter pénalités et tensions.`,
      impact: { label: 'à couvrir', amount: overdue.reduce((s, e) => s + e.item.amount, 0) },
      action: { label: 'Voir le calendrier', href: '/calendrier' },
    });
  const min = dailyMinimum(fc, '*');
  const firstNeg = [...min].find(([, v]) => v < 0);
  if (firstNeg) {
    const worst = Math.min(...min.values());
    out.push({
      id: 'manque', priority: 1, title: `Manque prévu à partir du ${formatDateFr(firstNeg[0])}`,
      detail: `Au plus bas, il manquerait ${formatFcfa(-worst)} sur vos portefeuilles du quotidien. Reportez les dépenses non essentielles, négociez une date, ou transférez depuis l’épargne.`,
      impact: { label: 'manque', amount: -worst },
      action: { label: 'Voir le calendrier', href: '/calendrier' },
    });
  }
  for (const late of fc.lateIncomes)
    out.push({
      id: `rentree-${late.id}`, priority: 1, title: `Rentrée en retard : ${late.label}`,
      detail: `${formatFcfa(late.amount)} attendus le ${formatDateFr(late.date)}. Relancez, puis confirmez ou replanifiez pour garder une prévision juste.`,
      action: { label: 'Confirmer ou replanifier', href: '/calendrier' },
    });

  // 2. Sécurité : fonds d'urgence.
  if (r.fixedCharges > 0 && r.emergencyMonths < 1) {
    const target = r.fixedCharges - savings;
    out.push({
      id: 'urgence-1', priority: 1, title: 'Constituer un premier mois de sécurité',
      detail: `Votre épargne couvre ${r.emergencyMonths.toFixed(1).replace('.', ',')} mois de charges. Avant tout placement ou remboursement anticipé, mettez de côté ${formatFcfa(target)} : c’est votre protection contre un imprévu (santé, panne, retard de paie).`,
      impact: { label: 'à épargner', amount: target },
      action: { label: 'Aller à l’épargne', href: '/epargne' },
    });
  } else if (r.fixedCharges > 0 && r.emergencyMonths < 3)
    out.push({
      id: 'urgence-3', priority: 2, title: 'Compléter le fonds d’urgence à 3 mois',
      detail: `Vous couvrez ${r.emergencyMonths.toFixed(1).replace('.', ',')} mois de charges. Objectif : 3 mois, soit ${formatFcfa(r.fixedCharges * 3)}.`,
      impact: { label: 'reste à épargner', amount: Math.max(0, r.fixedCharges * 3 - savings) },
      action: { label: 'Aller à l’épargne', href: '/epargne' },
    });

  // 3. Dettes.
  if (r.debtService > 1 / 3)
    out.push({
      id: 'endettement', priority: 1, title: 'Endettement trop élevé',
      detail: `Vos crédits absorbent ${Math.round(r.debtService * 100)} % de votre revenu principal. N’en prenez pas de nouveau ; remboursez en priorité le plus cher.`,
      action: { label: 'Voir mes crédits', href: '/credits' },
    });
  for (const l of (snap.loans ?? []).filter((x) => x.status === 'en_cours')) {
    if (l.annualRate > USURY_CAPS[l.lenderType])
      out.push({
        id: `usure-${l.id}`, priority: 1, title: `${l.label} : taux au-dessus du plafond légal`,
        detail: `${Math.round(l.annualRate * 1000) / 10} % pour un plafond de ${USURY_CAPS[l.lenderType] * 100} %. Demandez des explications au prêteur et, si besoin, à la BCEAO.`,
        action: { label: 'Voir le crédit', href: '/credits' },
      });
    const surplus = savings - r.fixedCharges * 3;
    if (l.annualRate >= 0.12 && surplus > 0) {
      const rows = amortization(l, l.extras);
      const last = rows.filter((x) => l.paid.includes(x.n)).at(-1);
      const remaining = last ? last.remaining : l.principal;
      const amount = Math.min(surplus, remaining);
      const sim = simulateEarlyRepayment(l, { date: snap.today, amount }, { already: l.extras, savingsRate: PLACEMENTS[0].rate });
      if (sim.worthIt)
        out.push({
          id: `anticipe-${l.id}`, priority: 2, title: `Rembourser plus tôt : ${l.label}`,
          detail: `Votre fonds d’urgence est complet. Verser ${formatFcfa(amount)} de plus économiserait ${formatFcfa(sim.interestSaved)} d’intérêts et ${sim.monthsSaved} mois, davantage que l’épargne (${formatFcfa(sim.savingsAlternative)}).`,
          impact: { label: 'intérêts économisés', amount: sim.interestSaved },
          action: { label: 'Simuler', href: '/credits' },
        });
    }
  }

  // 4. Maîtrise des dépenses.
  const cycle = currentCycle(snap);
  const st = incomeStats(snap.operations ?? [], snap.today, cycle.start);
  const plan = Math.max(0, st.mainMonthly - r.fixedCharges);
  if (st.cycleSpends.length && plan) {
    const pace = spendingPace({ today: snap.today, cycleStart: cycle.start, cycleEnd: cycle.end, plannedSpend: plan, spends: st.cycleSpends, extraIncomes: st.cycleSmallIncomes });
    if (pace.status !== 'dans_le_plan')
      out.push({
        id: 'rythme', priority: pace.status === 'derapage' ? 1 : 2, title: 'Dépenses au-dessus du rythme prévu',
        detail: `À ce rythme : ${formatFcfa(pace.projectedSpend)} sur le cycle, ${formatFcfa(pace.overrun)} de trop. Budget du jour conseillé : ${formatFcfa(pace.dailyAllowance)}.`,
        impact: { label: 'à éviter', amount: pace.overrun },
        action: { label: 'Mon budget', href: '/mon-budget' },
      });
  }
  if (r.smallShare > 0.3)
    out.push({
      id: 'coupures', priority: 2, title: 'Encadrer les petites coupures',
      detail: `${Math.round(r.smallShare * 100)} % de vos rentrées arrivent en petites sommes (${formatFcfa(r.smallIncome)} par mois). Notez chacune avec « J’ai reçu » et mettez-en 30 % de côté dès réception : ${formatFcfa(Math.ceil(r.smallIncome * 0.3))} par mois.`,
      impact: { label: 'épargne possible / mois', amount: Math.ceil(r.smallIncome * 0.3) },
      action: { label: 'Aller à l’épargne', href: '/epargne' },
    });
  for (const c of categoryStatus(snap.categories ?? [], snap.operations ?? [], cycle).filter((x) => x.status === 'depasse'))
    out.push({
      id: `plafond-${c.category}`, priority: 2, title: `Enveloppe ${c.category} dépassée`,
      detail: `${formatFcfa(c.spent)} dépensés pour un plafond de ${formatFcfa(c.cap)}. Réaffectez ${formatFcfa(-c.left)} depuis une autre enveloppe ou freinez jusqu’à la fin du cycle.`,
      impact: { label: 'dépassement', amount: -c.left },
      action: { label: 'Enveloppes', href: '/enveloppes' },
    });
  for (const t of categoryTrends(snap.operations ?? [], snap.today).filter((x) => x.change !== null && x.change > 0.3 && x.current >= 5_000).slice(0, 2))
    out.push({
      id: `hausse-${t.category}`, priority: 2, title: `${t.category} en hausse de ${Math.round(t.change! * 100)} %`,
      detail: `${formatFcfa(t.current)} depuis le début du mois, contre ${formatFcfa(t.sameDayAverage)} à la même date les mois précédents${t.smallCount >= 5 ? `, dont ${t.smallCount} petites dépenses` : ''}.`,
      action: { label: 'Mon analyste', href: '/analyste' },
    });

  // 5. Objectifs et placements.
  for (const g of (snap.goals ?? []).filter((x) => x.status === 'actif')) {
    const s = goalSchedule(g, snap.today);
    if (s.suggestedDate)
      out.push({
        id: `objectif-${g.id}`, priority: 2, title: `Objectif « ${g.name} » en retard`,
        detail: `Échéancier ajusté : ${formatFcfa(s.perInstallment)} par mois, objectif atteint le ${formatDateFr(s.suggestedDate)}.`,
        action: { label: 'Voir l’objectif', href: '/epargne' },
      });
  }
  const idle = savings - r.fixedCharges * 3;
  if (idle >= 100_000 && !out.some((a) => a.priority === 1)) {
    const best = PLACEMENTS.find((p) => p.id === 'titres_publics')!;
    out.push({
      id: 'placer', priority: 3, title: 'Faire travailler l’épargne au-delà du fonds d’urgence',
      detail: `${formatFcfa(idle)} dépassent vos 3 mois de sécurité. Placés 3 ans en titres publics (~${(best.rate * 100).toFixed(1).replace('.', ',')} %), ils deviendraient environ ${formatFcfa(futureValue(idle, 0, best.rate, 36))}.`,
      impact: { label: 'gain estimé sur 3 ans', amount: futureValue(idle, 0, best.rate, 36) - idle },
      action: { label: 'Comparer les placements', href: '/analyste' },
    });
  }
  if (loanRemaining(snap) === 0 && r.savingsRate < 0.1 && r.income > 0)
    out.push({
      id: 'taux-epargne', priority: 2, title: 'Augmenter le taux d’épargne',
      detail: `Vous épargnez ${Math.round(r.savingsRate * 100)} % de vos rentrées. Visez 10 % puis 20 % : ${formatFcfa(Math.ceil(r.income * 0.1))} par mois pour commencer, versés dès la paie.`,
      action: { label: 'Aller à l’épargne', href: '/epargne' },
    });

  return out.sort((a, b) => a.priority - b.priority);
}

/** Synthèse du banquier : score et première recommandation. */
export function bankerSummary(snap: Snapshot) {
  const health = financialHealth(snap);
  const list = advise(snap);
  return { health, top: list[0] ?? null, count: list.length };
}
