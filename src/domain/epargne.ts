import { diffDays, type CivilDate } from './dates';
import type { Francs } from './money';

export interface Goal {
  id: string;
  name: string;
  target: Francs;
  saved: Francs;
  date: CivilDate;
}

export interface SavingsInput {
  today: CivilDate;
  /** Revenu principal mensuel. */
  income: Francs;
  /** Moyenne mensuelle des petites rentrées (coupures, dépannages, ventes…). */
  smallIncome?: Francs;
  /** Charges essentielles mensuelles (loyer, factures, transport, nourriture). */
  essentials: Francs;
  goals: Goal[];
}

export interface GoalPlan {
  goal: Goal;
  monthly: Francs;
  monthsLeft: number;
  /** Date réaliste si l'objectif dépasse ce qui est possible (ou s'il est échu). */
  suggestedDate: CivilDate | null;
}

export interface SavingsAdvice {
  /** Épargne mensuelle recommandée. */
  recommended: Francs;
  /** Plancher à tenir même un mois difficile. */
  minimum: Francs;
  /** Reste à vivre après charges et épargne recommandée. */
  leftToLive: Francs;
  plans: GoalPlan[];
  /** Objectif ajouté d'office quand aucun n'existe : fonds d'urgence de 3 mois de charges. */
  addedDefaultGoal: Goal | null;
  /** Part des petites rentrées à mettre de côté dès réception. */
  smallIncomeRule: { rate: number; monthly: Francs };
  notes: string[];
}

const ceil = (n: number) => Math.ceil(n);

function addMonths(d: CivilDate, n: number): CivilDate {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * Recommandation d'épargne : 20 % du revenu total visé (règle 50/30/20), plancher 10 %,
 * relevée si les objectifs datés l'exigent, plafonnée par ce qui reste après les charges essentielles.
 * Les petites rentrées sont épargnées à 30 % dès réception, car c'est l'argent qui « disparaît ».
 */
export function adviseSavings(input: SavingsInput): SavingsAdvice {
  const small = input.smallIncome ?? 0;
  const total = input.income + small;
  const capacity = Math.max(0, total - input.essentials);
  const notes: string[] = [];

  let goals = input.goals;
  let addedDefaultGoal: Goal | null = null;
  if (goals.length === 0) {
    addedDefaultGoal = {
      id: 'fonds-urgence', name: 'Fonds d’urgence (3 mois de charges)',
      target: input.essentials * 3, saved: 0, date: addMonths(input.today, 12),
    };
    goals = [addedDefaultGoal];
    notes.push('Aucun objectif : un fonds d’urgence de 3 mois de charges est proposé sur 12 mois.');
  }

  const plans: GoalPlan[] = goals.map((g) => {
    const remaining = Math.max(0, g.target - g.saved);
    const monthsLeft = Math.max(0, Math.floor(diffDays(input.today, g.date) / 30.4375));
    const monthly = remaining === 0 ? 0 : ceil(remaining / Math.max(1, monthsLeft));
    return { goal: g, monthly, monthsLeft, suggestedDate: null };
  });
  const goalsNeed = plans.reduce((s, p) => s + p.monthly, 0);

  const target20 = ceil(total * 0.2);
  const minimum = Math.min(ceil(total * 0.1), capacity);
  let recommended = Math.min(Math.max(target20, goalsNeed), capacity);

  if (capacity === 0) notes.push('Les charges essentielles absorbent tout le revenu : réduisez-les avant d’épargner.');
  else if (goalsNeed > capacity) {
    notes.push('Vos objectifs demandent plus que votre capacité : dates repoussées proposées.');
    // Répartit la capacité au prorata et calcule une date réaliste pour chaque objectif.
    for (const p of plans) {
      const share = Math.max(1, Math.floor((capacity * p.monthly) / goalsNeed));
      const remaining = p.goal.target - p.goal.saved;
      p.suggestedDate = addMonths(input.today, Math.ceil(remaining / share));
      p.monthly = share;
    }
    recommended = capacity;
  }
  if (recommended < ceil(total * 0.1) && capacity > 0) notes.push('Moins de 10 % du revenu : épargne fragile, revoyez vos charges.');

  const rate = 0.3;
  return {
    recommended,
    minimum,
    leftToLive: total - input.essentials - recommended,
    plans,
    addedDefaultGoal,
    smallIncomeRule: { rate, monthly: ceil(small * rate) },
    notes,
  };
}
