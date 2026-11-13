/** Montants en francs CFA entiers (XOF, sans décimales). */
export type Francs = number;

export function assertFrancs(n: number): Francs {
  if (!Number.isSafeInteger(n)) throw new Error(`Montant non entier : ${n}`);
  return n;
}

/** 30000 → « 30 000 F » (espace insécable : visible même en gras, jamais coupée en fin de ligne). */
export function formatFcfa(n: Francs): string {
  const sign = n < 0 ? '−' : '';
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${sign}${digits} F`;
}

/** « 30 000 », « 30000 F » → 30000 ; null si invalide. */
export function parseFcfa(text: string): Francs | null {
  const t = text.trim().replace(/\s*F(CFA)?$/i, '').replace(/[\s  ]/g, '');
  // Le point n'est accepté que comme séparateur de milliers (« 30.000 ») : « 1.5 » est refusé, pas lu 15.
  if (t.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(t)) return null;
  const clean = t.replace(/\./g, '');
  if (!/^\d{1,12}$/.test(clean)) return null;
  return Number(clean);
}
