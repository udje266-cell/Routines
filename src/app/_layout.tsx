import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { C } from '@/components/ui';
import { LockGate } from '@/components/lock-gate';
import { FinanceProvider } from '@/data/finance-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <FinanceProvider>
      <StatusBar style="dark" />
      <LockGate>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: C.fond }, headerTintColor: C.texte, headerShadowVisible: false,
        headerTitleStyle: { color: C.texte, fontWeight: '800', fontSize: 22 },
        contentStyle: { backgroundColor: C.fond },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connexion" options={{ headerShown: false }} />
        <Stack.Screen name="bienvenue" options={{ title: 'Bienvenue', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="recuperation" options={{ title: 'Récupérer mon accès' }} />
        <Stack.Screen name="tester-achat" options={{ title: 'Puis-je l’acheter ?', presentation: 'modal' }} />
        <Stack.Screen name="ajouter" options={{ title: 'Noter', presentation: 'modal' }} />
        <Stack.Screen name="mon-budget" options={{ title: 'Simulateur' }} />
        <Stack.Screen name="depenses-mensuelles" options={{ title: 'Factures du mois' }} />
        <Stack.Screen name="analyste" options={{ title: 'Mon analyste' }} />
        <Stack.Screen name="credits" options={{ title: 'Crédits' }} />
        <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
        <Stack.Screen name="achat-en-pause" options={{ title: 'Achat en pause' }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
        <Stack.Screen name="operation" options={{ title: 'Modifier', presentation: 'modal' }} />
        <Stack.Screen name="bilan" options={{ title: 'Bilan du mois' }} />
        <Stack.Screen name="enveloppes" options={{ title: 'Limites de dépenses' }} />
      </Stack>
      </LockGate>
    </FinanceProvider>
  );
}
