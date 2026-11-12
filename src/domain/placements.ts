import type { Francs } from './money';

/**
 * Placements accessibles en Côte d'Ivoire : repères indicatifs relevés en novembre 2026
 * (taux variables selon l'établissement et le montant ; à vérifier auprès de la banque ou de la SGI).
 * Information pédagogique, pas un conseil en investissement personnalisé.
 */
export interface Placement {
  id: 'livret' | 'dat' | 'titres_publics';
  name: string;
  /** Taux annuel indicatif retenu pour les simulations. */
  rate: number;
  range: string;
  /** Durée minimale conseillée, en mois. */
  minMonths: number;
  liquidity: string;
  risk: string;
  source: string;
}

export const PLACEMENTS: Placement[] = [
  {
    id: 'livret', name: 'Livret ou compte d’épargne bancaire', rate: 0.035, range: '2,5 à 5,5 % selon la banque', minMonths: 0,
    liquidity: 'Disponible à tout moment : idéal pour le fonds d’urgence.', risk: 'Très faible.',
    source: 'Comparatif des banques ivoiriennes, 2026 (blog.iambeezy.app)',
  },
  {
    id: 'dat', name: 'Dépôt à terme (DAT)', rate: 0.05, range: '4 à 5,5 % selon la durée et le montant', minMonths: 6,
    liquidity: 'Bloqué jusqu’à l’échéance (6 à 24 mois) ; retrait anticipé pénalisé.', risk: 'Très faible.',
    source: 'Comparatif des banques ivoiriennes, 2026 (blog.iambeezy.app)',
  },
  {
    id: 'titres_publics', name: 'Titres de l’État ivoirien (obligations, emprunts par appel public)', rate: 0.066, range: '≈ 6,6 % à 3 ans, ≈ 7,1 % à 5 ans', minMonths: 36,
    liquidity: 'Revente possible à la BRVM via une SGI, mais à un prix non garanti avant l’échéance.', risk: 'Faible (risque État), frais de SGI à prévoir.',
    source: 'Adjudications juin-juillet 2026, ministère des Finances (dgf.gouv.ci)',
  },
];

/** Valeur future avec capitalisation mensuelle : capital initial + versements mensuels. */
export function futureValue(initial: Francs, monthly: Francs, annualRate: number, months: number): Francs {
  const r = annualRate / 12;
  if (r === 0) return initial + monthly * months;
  const g = Math.pow(1 + r, months);
  return Math.round(initial * g + monthly * ((g - 1) / r));
}

/** Placement adapté à l'horizon : sécurité d'abord, rendement ensuite. */
export function placementFor(months: number, emergencyComplete: boolean): Placement {
  if (!emergencyComplete || months < 6) return PLACEMENTS[0];
  if (months < 36) return PLACEMENTS[1];
  return PLACEMENTS[2];
}
