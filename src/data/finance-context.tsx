import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { todayAbidjan, type Snapshot } from '@/domain';
import { supabase } from '@/lib/supabase';

import { DemoRepository } from './demo-repository';
import { ConnectionRequiredError, type FinanceRepository } from './repository';
import { SupabaseRepository } from './supabase-repository';

type Status = 'deconnecte' | 'chargement' | 'pret' | 'connexion_requise' | 'erreur';

interface FinanceState {
  repo: FinanceRepository | null;
  snapshot: Snapshot | null;
  status: Status;
  error: string | null;
  startDemo(): void;
  openAccount(): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  /** Exécute une écriture puis recharge ; lève ConnectionRequiredError si le serveur ne répond pas. */
  write(fn: (repo: FinanceRepository) => Promise<void>): Promise<void>;
}

const Ctx = createContext<FinanceState | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<FinanceRepository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>('deconnecte');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: FinanceRepository) => {
    setStatus((s) => (s === 'pret' ? s : 'chargement'));
    try {
      setSnapshot(await r.loadSnapshot(todayAbidjan()));
      setStatus('pret');
      setError(null);
    } catch (e) {
      setStatus(e instanceof ConnectionRequiredError ? 'connexion_requise' : 'erreur');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const select = useCallback(
    (r: FinanceRepository | null) => {
      setRepo(r);
      if (r) load(r);
      else {
        setSnapshot(null);
        setStatus('deconnecte');
      }
    },
    [load],
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) select(new SupabaseRepository(supabase!));
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') select(null);
    });
    return () => data.subscription.unsubscribe();
  }, [select]);

  const value = useMemo<FinanceState>(
    () => ({
      repo, snapshot, status, error,
      startDemo: () => select(new DemoRepository(todayAbidjan())),
      openAccount: () => {
        if (supabase) select(new SupabaseRepository(supabase));
      },
      signOut: async () => {
        // efface la session chiffrée de l'appareil ; les données ne sont gardées qu'en mémoire
        if (repo?.mode === 'compte') await supabase?.auth.signOut({ scope: 'local' });
        select(null);
      },
      refresh: async () => {
        if (repo) await load(repo);
      },
      write: async (fn) => {
        if (!repo) throw new Error('Aucun compte');
        try {
          await fn(repo);
        } catch (e) {
          if (e instanceof ConnectionRequiredError) setStatus('connexion_requise');
          throw e;
        }
        await load(repo);
      },
    }),
    [repo, snapshot, status, error, load, select],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('FinanceProvider manquant');
  return v;
}
