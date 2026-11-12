import { useRef, useState } from 'react';

import { newClientKey } from './client-key';
import { useFinance } from './finance-context';
import { ConnectionRequiredError, RefusedError, type FinanceRepository } from './repository';

/**
 * Écriture avec clé d'opération stable : la même clé est réutilisée à chaque réessai tant que
 * l'écriture n'a pas réussi, pour qu'une coupure suivie d'un nouvel envoi ne crée jamais de doublon.
 */
export function useWrite(prefix: string) {
  const { write } = useFinance();
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: (repo: FinanceRepository, clientKey: string) => Promise<void>): Promise<boolean> {
    key.current ??= newClientKey(prefix);
    setBusy(true);
    setError(null);
    try {
      await write((repo) => fn(repo, key.current!));
      key.current = null; // succès : la prochaine intention aura une nouvelle clé
      return true;
    } catch (e) {
      setError(
        e instanceof ConnectionRequiredError ? 'Connexion requise. Votre saisie est conservée : réessayez, rien ne sera créé deux fois.'
        : e instanceof RefusedError ? e.message
        : 'Enregistrement refusé.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, setError };
}
