import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { C, Label, Screen } from '@/components/ui';
import { useFinance } from '@/data/finance-context';

type Item = { href: Href; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string };

/** Les outils, rangés par besoin et expliqués en une phrase (révélation progressive). */
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Comprendre mon argent',
    items: [
      { href: '/analyste', icon: 'analytics-outline', title: 'Mon analyste', sub: 'Ma note sur 100 et les conseils à suivre' },
      { href: '/bilan', icon: 'pie-chart-outline', title: 'Bilan du mois', sub: 'Ce que j’ai reçu, dépensé et mis de côté' },
      { href: '/historique', icon: 'list-outline', title: 'Historique', sub: 'Toutes mes opérations, à corriger si besoin' },
    ],
  },
  {
    title: 'Organiser',
    items: [
      { href: '/depenses-mensuelles', icon: 'repeat-outline', title: 'Factures du mois', sub: 'Loyer, CIE, SODECI, tontine… qui reviennent' },
      { href: '/enveloppes', icon: 'wallet-outline', title: 'Limites de dépenses', sub: 'Un maximum par poste (sorties, transport…)' },
      { href: '/mon-budget', icon: 'calculator-outline', title: 'Simulateur', sub: 'Tester d’autres revenus, dépenses ou épargne' },
    ],
  },
  {
    title: 'Emprunter',
    items: [{ href: '/credits', icon: 'business-outline', title: 'Crédits', sub: 'Voir le vrai coût avant de signer, suivre, rembourser' }],
  },
  {
    title: 'Mon compte',
    items: [{ href: '/reglages', icon: 'settings-outline', title: 'Réglages', sub: 'Empreinte, rappels, suppression du compte' }],
  },
];

export default function Plus() {
  const { signOut, repo } = useFinance();
  return (
    <Screen>
      {GROUPS.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <Label muted>{g.title}</Label>
          {g.items.map((i) => (
            <Pressable key={i.title} onPress={() => router.push(i.href)} accessibilityRole="button" accessibilityLabel={`${i.title}. ${i.sub}`}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: C.carte,
                borderWidth: 1, borderColor: C.bord, opacity: pressed ? 0.7 : 1,
              })}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.lavandeClair, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={i.icon} size={24} color={C.marine} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte }}>{i.title}</Text>
                <Text style={{ fontSize: 14, color: C.secondaire }}>{i.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.secondaire} />
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable onPress={signOut} accessibilityRole="button" style={{ padding: 14, alignItems: 'center' }}>
        <Text style={{ color: C.risque, fontSize: 16, fontWeight: '600' }}>{repo?.mode === 'demo' ? 'Quitter la découverte' : 'Se déconnecter'}</Text>
      </Pressable>
    </Screen>
  );
}
