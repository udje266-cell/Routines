import type { Francs } from './money';

/**
 * Repères de coût de la vie à Abidjan (relevés nov. 2026, sources secondaires : guides et comparateurs,
 * voir docs/cout-de-la-vie.md). Valeurs indicatives, modifiables par l'utilisateur.
 */
export const REPERES_ABIDJAN = {
  smigMensuel: 75_000,
  inflationAnnuelle: 0.012, // INS, glissement août 2026
  trajet: { woroWoro: [200, 500], gbaka: [100, 300], sotra: [200, 400], motoTaxi: [300, 1_000], taxiCompteur: [1_500, 5_000] },
  repasLocal: { yopougon: 1_500, cocody: 2_500 },
  loyerStudio: { 'Yopougon/Abobo': [30_000, 60_000], 'Cocody/Riviera': [60_000, 120_000], 'Plateau/Marcory': [80_000, 150_000] },
  litreSuper: 905,
} as const satisfies Record<string, unknown>;

/** Estimation mensuelle du quotidien à partir d'habitudes (22 jours ouvrés par défaut). */
export function estimateDaily(h: { trajetsParJour: number; prixTrajet: Francs; repasParJour: number; prixRepas: Francs; jours?: number }): Francs {
  const j = h.jours ?? 22;
  return Math.round(j * (h.trajetsParJour * h.prixTrajet + h.repasParJour * h.prixRepas));
}
