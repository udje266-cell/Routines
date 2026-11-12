/** Dates civiles 'YYYY-MM-DD' (Africa/Abidjan = UTC, sans heure d'été). */
export type CivilDate = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(d: CivilDate): number {
  const m = RE.exec(d);
  if (!m) throw new Error(`Date civile invalide : ${d}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function fromUtc(ms: number): CivilDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: CivilDate, n: number): CivilDate {
  return fromUtc(toUtc(d) + n * 86_400_000);
}

export function diffDays(a: CivilDate, b: CivilDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Jour mensuel ramené au dernier jour du mois s'il n'existe pas (31 → 30 ou 28/29). */
export function monthlyDate(year: number, month1: number, day: number): CivilDate {
  const d = Math.min(day, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Date du jour à Abidjan. */
export function todayAbidjan(now: Date = new Date()): CivilDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(now);
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function formatDateFr(d: CivilDate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MOIS[m - 1]} ${y}`;
}

export function startOfMonth(d: CivilDate): CivilDate {
  return `${d.slice(0, 8)}01`;
}

export function endOfMonth(d: CivilDate): CivilDate {
  const [y, m] = d.split('-').map(Number);
  return monthlyDate(y, m, 31);
}
