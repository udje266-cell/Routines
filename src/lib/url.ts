/** En production, seule une URL HTTPS est acceptée (échanges chiffrés). */
export function acceptableUrl(u: string | undefined, dev: boolean): boolean {
  return !!u && (dev || u.startsWith('https://'));
}
