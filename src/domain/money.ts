/** Montants en francs CFA entiers (XOF, sans décimales). */
export type Francs = number;

export function assertFrancs(n: number): Francs {
  if (!Number.isSafeInteger(n)) throw new Error(`Montant non entier : ${n}`);
  return n;
}

/** 30000 → « 30 000 F » (espace insécable fine). */
export function formatFcfa(n: Francs): string {
  const sign = n < 0 ? '−' : '';
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits} F`;
}

/** « 30 000 », « 30000 F » → 30000 ; null si invalide. */
export function parseFcfa(text: string): Francs | null {
  const clean = text.replace(/[\s  .F]/gi, '');
  if (!/^\d{1,12}$/.test(clean)) return null;
  return Number(clean);
}
