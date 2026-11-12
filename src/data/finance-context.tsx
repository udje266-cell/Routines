import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { buildReminders, todayAbidjan, type Snapshot } from '@/domain';
import { cancelReminders, scheduleReminders } from '@/lib/notifications';
import { clearPrefs, DEFAULT_PREFS, loadPrefs, savePrefs, type DevicePrefs } from '@/lib/preferences';
import { supabase } from '@/lib/supabase';

import { DemoRepository } from './demo-repository';
import { ConnectionRequiredError, type FinanceRepository } from './repository';
import { SupabaseRepository } from './supabase-repository';

type Status = 'deconnecte' | 'chargement' | 'pret' | 'connexion_requise' | 'erreur';

interface FinanceState {
  repo: FinanceRepository | null;
  /** Vrai tant que la session enregistrée sur l'appareil n'a pas été relue (ne pas rediriger vers la connexion). */
  restoring: boolean;
  /** Compte réel sans aucun compte d'argent : afficher la configuration guidée. */
  onboardingNeeded: boolean;
  snapshot: Snapshot | null;
  status: Status;
  error: string | null;
  startDemo(): void;
  openAccount(): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  /** Exécute une écriture puis recharge ; lève ConnectionRequiredError si le serveur ne répond pas. */
  write(fn: (repo: FinanceRepository) => Promise<void>): Promise<void>;
  prefs: DevicePrefs;
  /** Faux tant que les préférences de l'appareil (dont le verrou) ne sont pas lues. */
  prefsLoaded: boolean;
  setPrefs(p: DevicePrefs): Promise<void>;
  /** Supprime le compte sur le serveur puis efface tout ce qui reste sur l'appareil. */
  deleteAccount(): Promise<void>;
}

const Ctx = createContext<FinanceState | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<FinanceRepository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>('deconnecte');
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<DevicePrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(supabase));

  useEffect(() => {
    loadPrefs().then((p) => {
      setPrefsState(p);
      setPrefsLoaded(true);
    });
  }, []);

  // Rappels reprogrammés à chaque changement de données ou de réglage (jamais en découverte, jamais sur le web).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!snapshot || repo?.mode !== 'compte' || !prefs.reminders.enabled) {
      cancelReminders().catch(() => {});
      return;
    }
    scheduleReminders(buildReminders(snapshot, prefs.reminders)).catch(() => {});
  }, [snapshot, prefs, repo]);


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

  const wipeDevice = useCallback(async () => {
    if (Platform.OS !== 'web') await cancelReminders().catch(() => {});
    await clearPrefs().catch(() => {});
    setPrefsState(DEFAULT_PREFS);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session) select(new SupabaseRepository(supabase!));
      })
      .finally(() => setRestoring(false));
    // Renouvellement du jeton seulement quand l'application est au premier plan (recommandation Supabase pour React Native).
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();
    const appState = AppState.addEventListener('change', (s) => {
      if (Platform.OS === 'web' || !supabase) return;
      if (s === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Déconnexion, y compris forcée par le serveur (jeton révoqué) : on efface aussi l'appareil.
      if (event === 'SIGNED_OUT') {
        wipeDevice();
        select(null);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      appState.remove();
    };
  }, [select, wipeDevice]);

  const value = useMemo<FinanceState>(
    () => ({
      repo, restoring, snapshot, status, error,
      onboardingNeeded: repo?.mode === 'compte' && status === 'pret' && !!snapshot && snapshot.wallets.length === 0,
      startDemo: () => select(new DemoRepository(todayAbidjan())),
      openAccount: () => {
        if (supabase) select(new SupabaseRepository(supabase));
      },
      signOut: async () => {
        // efface la session chiffrée, les rappels et les préférences de l'appareil ; les données n'étaient qu'en mémoire
        try {
          if (repo?.mode === 'compte') await supabase?.auth.signOut({ scope: 'local' });
        } finally {
          if (repo?.mode === 'compte') await wipeDevice();
          select(null);
        }
      },
      prefs,
      prefsLoaded,
      setPrefs: async (p) => {
        await savePrefs(p);
        setPrefsState(p);
      },
      deleteAccount: async () => {
        if (!repo) return;
        await repo.deleteAccount();
        await supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
        await wipeDevice();
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
    [repo, restoring, snapshot, status, error, load, select, prefs, prefsLoaded, wipeDevice],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('FinanceProvider manquant');
  return v;
}
