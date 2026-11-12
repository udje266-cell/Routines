import type { Ionicons } from '@expo/vector-icons';

import type { WalletKind } from '@/domain';

type Icon = keyof typeof Ionicons.glyphMap;

/** Catégories de dépenses, avec une icône familière pour chacune (moins de texte à lire). */
export const CATEGORY_TILES: { value: string; label: string; icon: Icon }[] = [
  { value: 'Alimentation', label: 'Nourriture', icon: 'restaurant-outline' },
  { value: 'Transport', label: 'Transport', icon: 'bus-outline' },
  { value: 'Logement', label: 'Maison', icon: 'home-outline' },
  { value: 'Sorties', label: 'Sorties', icon: 'happy-outline' },
  { value: 'Famille', label: 'Famille', icon: 'people-outline' },
  { value: 'Santé', label: 'Santé', icon: 'medkit-outline' },
  { value: 'Scolarité', label: 'École', icon: 'school-outline' },
  { value: 'Habillement', label: 'Habits', icon: 'shirt-outline' },
  { value: 'Communication', label: 'Crédit tél.', icon: 'phone-portrait-outline' },
  { value: 'Autre', label: 'Autre', icon: 'ellipsis-horizontal-circle-outline' },
];

export const WALLET_TILES: { value: WalletKind; label: string; icon: Icon }[] = [
  { value: 'wave', label: 'Wave', icon: 'phone-portrait-outline' },
  { value: 'orange_money', label: 'Orange Money', icon: 'phone-portrait-outline' },
  { value: 'especes', label: 'Espèces', icon: 'cash-outline' },
  { value: 'banque', label: 'Banque', icon: 'business-outline' },
  { value: 'epargne', label: 'Épargne', icon: 'leaf-outline' },
];

export function walletIcon(kind: WalletKind): Icon {
  return WALLET_TILES.find((w) => w.value === kind)?.icon ?? 'wallet-outline';
}

export function categoryLabel(value: string): string {
  return CATEGORY_TILES.find((c) => c.value === value)?.label ?? value;
}

/** Icône d'une opération prévue, d'après son libellé, sa catégorie ou son origine. */
export function itemIcon(label: string, category?: string, kind?: 'sortie' | 'rentree' | 'transfert', source?: string): Icon {
  const l = label.toLowerCase();
  if (l.includes('loyer')) return 'home-outline';
  if (l.includes('cie') || l.includes('électr')) return 'flash-outline';
  if (l.includes('sodeci') || l.includes('eau')) return 'water-outline';
  if (l.includes('internet') || l.includes('téléphone')) return 'wifi-outline';
  if (l.includes('tontine')) return 'people-outline';
  if (source === 'epargne' || l.includes('épargne')) return 'wallet-outline';
  if (source === 'dette' || category === 'Crédit') return 'swap-horizontal-outline';
  if (kind === 'rentree') return 'arrow-down-circle-outline';
  return CATEGORY_TILES.find((c) => c.value === category)?.icon ?? 'receipt-outline';
}
