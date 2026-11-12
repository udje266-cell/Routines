import { randomUUID } from 'expo-crypto';

/** Clé stable d'une intention d'écriture : générée une fois, réutilisée à chaque réessai. */
export function newClientKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
