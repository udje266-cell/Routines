import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { C } from '@/components/ui';
import { FinanceProvider } from '@/data/finance-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <FinanceProvider>
      <Stack screenOptions={{ headerTintColor: C.texte, contentStyle: { backgroundColor: C.fond } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connexion" options={{ title: 'Mes Finances', headerBackVisible: false }} />
        <Stack.Screen name="tester-achat" options={{ title: 'Tester un achat', presentation: 'modal' }} />
        <Stack.Screen name="ajouter" options={{ title: 'Ajouter', presentation: 'modal' }} />
        <Stack.Screen name="mon-budget" options={{ title: 'Mon budget' }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
        <Stack.Screen name="bilan" options={{ title: 'Bilan du cycle' }} />
        <Stack.Screen name="enveloppes" options={{ title: 'Cycle et enveloppes' }} />
      </Stack>
    </FinanceProvider>
  );
}
