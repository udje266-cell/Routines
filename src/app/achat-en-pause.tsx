import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button, C, Label, Pill, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { formatDateCourt, formatFcfa } from '@/domain';
import { categoryLabel, CATEGORY_TILES } from '@/lib/categories';

/** Un achat mis en pause : le revoir (relancer la simulation) ou y renoncer. */
export default function AchatEnPause() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, prefs } = useFinance();
  const w = useWrite('pause');
  const [remind, setRemind] = useState(prefs.reminders.enabled);
  const intent = (snapshot?.intents ?? []).find((i) => i.id === id);

  if (!intent) return <Screen><Label muted>Cet achat n’est plus en pause.</Label></Screen>;
  const icon = CATEGORY_TILES.find((c) => c.value === intent.category)?.icon ?? 'bag-outline';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.violetClair, borderRadius: 20, padding: 20 }}
        accessible accessibilityLabel={`${categoryLabel(intent.category)}, ${formatFcfa(intent.amount)}`}>
        <Ionicons name={icon} size={44} color={C.texte} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(30,24,59,0.2)' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.texte }}>{categoryLabel(intent.category)}</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: C.texte }} adjustsFontSizeToFit numberOfLines={1}>{formatFcfa(intent.amount)} CFA</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center' }}><Pill>À revoir le {formatDateCourt(intent.date)}</Pill></View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, paddingHorizontal: 16,
        borderRadius: 16, borderWidth: 1, borderColor: C.bord, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 17, color: C.texte }}>Me rappeler</Text>
        <Switch value={remind} onValueChange={(v) => { setRemind(v); if (v && !prefs.reminders.enabled) router.push('/reglages'); }}
          trackColor={{ true: C.violet, false: C.lavande }} thumbColor="#fff" accessibilityLabel="Me rappeler cet achat" />
      </View>
      {remind && !prefs.reminders.enabled ? <Label muted>Activez les rappels dans les réglages pour être prévenu.</Label> : null}

      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      <Button label="Relancer la simulation" onPress={() =>
        router.replace({ pathname: '/tester-achat', params: { intentId: intent.id, amount: String(intent.amount), category: intent.category, walletId: intent.walletId } })} />
      <Button label="Renoncer" variant="secondaire" disabled={w.busy}
        onPress={() => w.run((r) => r.updateIntent(intent.id, 'abandonne')).then((ok) => ok && router.back())} />
      <Label muted>Renoncer ne crée pas d’épargne automatiquement : si vous voulez garder cet argent, versez-le dans l’onglet Épargne.</Label>
    </Screen>
  );
}
