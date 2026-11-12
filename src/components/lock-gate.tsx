import { Image } from 'expo-image';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Text, View } from 'react-native';

import { useFinance } from '@/data/finance-context';
import { unlock } from '@/lib/verrou';

import { Button, C } from './ui';

/**
 * Verrouillage facultatif : au démarrage et à chaque retour sur l'application, l'empreinte
 * (ou le code de l'appareil) est demandée avant d'afficher le budget.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { prefs, prefsLoaded, repo } = useFinance();
  const native = Platform.OS !== 'web';
  const active = prefs.lock && repo?.mode === 'compte' && native;
  const [locked, setLocked] = useState(true);
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);

  const tryUnlock = () => {
    if (asking.current) return;
    asking.current = true;
    unlock()
      .catch(() => false)
      .then((ok) => {
        asking.current = false;
        setFailed(!ok);
        if (ok) setLocked(false);
      });
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setLocked(true);
    });
    return () => sub.remove();
  }, []);

  // Verrou actif : ni capture d'écran ni vignette dans les applications récentes (FLAG_SECURE).
  useEffect(() => {
    if (!native) return;
    (active ? ScreenCapture.preventScreenCaptureAsync('verrou') : ScreenCapture.allowScreenCaptureAsync('verrou')).catch(() => {});
  }, [active, native]);

  // Demande automatique à l'ouverture et à chaque retour sur l'application.
  useEffect(() => {
    if (active && locked) tryUnlock();
  }, [active, locked]);

  // Tant que le réglage du verrou n'est pas lu, on n'affiche aucun montant.
  if (native && !prefsLoaded) return <View style={{ flex: 1, backgroundColor: C.marine }} />;
  if (!active || !locked) return <>{children}</>;
  // Écran neutre : aucun montant n'est visible tant que l'application est verrouillée.
  return (
    <View style={{ flex: 1, backgroundColor: C.marine, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Image source={require('@/assets/images/mf-icon.png')} style={{ width: 120, height: 120, borderRadius: 24 }} accessibilityLabel="Mes Finances" />
      {failed ? <Text style={{ color: C.lavande, fontSize: 16 }}>Déverrouillage annulé.</Text> : null}
      <View style={{ alignSelf: 'stretch' }}>
        <Button label="Déverrouiller" hint="Utilise l’empreinte ou le code de l’appareil" onPress={tryUnlock} />
      </View>
    </View>
  );
}
