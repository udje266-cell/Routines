import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: C.marine }, headerTintColor: '#fff', headerTitleStyle: { color: '#fff' },
        contentStyle: { backgroundColor: C.fond },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connexion" options={{ title: 'Mes Finances', headerBackVisible: false }} />
        <Stack.Screen name="tester-achat" options={{ title: 'Tester un achat', presentation: 'modal' }} />
        <Stack.Screen name="ajouter" options={{ title: 'Ajouter', presentation: 'modal' }} />
        <Stack.Screen name="mon-budget" options={{ title: 'Mon budget' }} />
        <Stack.Screen name="depenses-mensuelles" options={{ title: 'Dépenses du mois' }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
        <Stack.Screen name="bilan" options={{ title: 'Bilan du cycle' }} />
        <Stack.Screen name="enveloppes" options={{ title: 'Cycle et enveloppes' }} />
      </Stack>
    </FinanceProvider>
  );
}
