import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '@/components/ui';
import { useFinance } from '@/data/finance-context';

type IconName = keyof typeof Ionicons.glyphMap;
/** Icône d'onglet ; l'onglet actif est posé sur une pastille lavande (maquettes). */
const icon = (name: IconName, active: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14, backgroundColor: focused ? C.violetClair : 'transparent' }}>
        <Ionicons name={focused ? active : name} size={24} color={color as string} />
      </View>
    );
  };

export default function TabsLayout() {
  const { repo, restoring, onboardingNeeded } = useFinance();
  const insets = useSafeAreaInsets();
  // Session en cours de relecture : écran neutre, surtout pas de redirection vers la connexion.
  if (restoring)
    return (
      <View style={{ flex: 1, backgroundColor: C.marine, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.menthe} size="large" accessibilityLabel="Ouverture de votre compte" />
      </View>
    );
  if (!repo) return <Redirect href="/connexion" />;
  if (onboardingNeeded) return <Redirect href="/bienvenue" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hauteur explicite : icône sur pastille + libellé toujours visibles, au-dessus de la barre de gestes du téléphone.
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.bord, height: 84 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 10 },
        tabBarActiveTintColor: C.violet,
        tabBarInactiveTintColor: C.texte,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 4 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelPosition: 'below-icon',
        tabBarIconStyle: { width: 64, height: 32 },
        sceneStyle: { backgroundColor: C.fond },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="calendrier" options={{ title: 'Agenda', tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="dettes" options={{ title: 'Dettes', tabBarIcon: icon('layers-outline', 'layers') }} />
      <Tabs.Screen name="epargne" options={{ title: 'Épargne', tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}
