import { type CivilDate, monthlyDate } from './dates';

export interface MonthlyRule {
  /** Jour du mois voulu (1-31), ramené au dernier jour si absent. */
  day: number;
  start: CivilDate;
  end?: CivilDate;
  /** Modifications d'une seule occurrence : date prévue d'origine → nouvelle date (ou null = supprimée). */
  overrides?: Record<CivilDate, CivilDate | null>;
}

export interface Occurrence {
  /** Date prévue par la règle, identifiant stable de l'occurrence. */
  original: CivilDate;
  date: CivilDate;
}

/** Occurrences d'une règle mensuelle dont la date tombe dans [from, to]. */
export function monthlyOccurrences(rule: MonthlyRule, from: CivilDate, to: CivilDate): Occurrence[] {
  const out: Occurrence[] = [];
  let [y, m] = rule.start.split('-').map(Number);
  // marge d'un mois pour une occurrence reportée qui retomberait dans la fenêtre
  for (let guard = 0; guard < 1200; guard++) {
    const original = monthlyDate(y, m, rule.day);
    if (rule.end && original > rule.end) break;
    if (original > to && original > addMonthStr(to)) break;
    if (original >= rule.start) {
      const ov = rule.overrides?.[original];
      const date = ov === undefined ? original : ov;
      if (date !== null && date >= from && date <= to) out.push({ original, date });
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function addMonthStr(d: CivilDate): CivilDate {
  const [y, m] = d.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-31` : monthlyDate(y, m + 1, 31);
}

/** « Modifier cette occurrence et les suivantes » : coupe la règle et en démarre une nouvelle. */
export function splitRule(rule: MonthlyRule, fromOriginal: CivilDate, newDay: number): [MonthlyRule, MonthlyRule] {
  const before: MonthlyRule = { ...rule, end: addDaysStr(fromOriginal, -1) };
  const after: MonthlyRule = { day: newDay, start: fromOriginal, end: rule.end };
  return [before, after];
}

function addDaysStr(d: CivilDate, n: number): CivilDate {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
