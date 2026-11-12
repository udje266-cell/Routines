import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useFinance } from '@/data/finance-context';

/**
 * Palette tirée de l'icône et du logo Mes Finances :
 * marine (fond de l'icône, texte du logo), lavande (calendrier-portefeuille), menthe (repère du logo).
 * Rouge et ambre restent réservés aux alertes ; chaque statut a aussi une icône et un libellé.
 */
export const C = {
  marine: '#1E183B',
  marineDoux: '#2E2757',
  lavande: '#D9D1FB',
  lavandeClair: '#EFEBFE',
  menthe: '#8EE3C8',
  mentheClair: '#E4F8F1',
  /** Menthe foncée pour du texte sur fond clair (contraste ≥ 4,5:1). */
  mentheTexte: '#12704F',
  texte: '#1E183B',
  secondaire: '#5B5675',
  fond: '#F7F5FE',
  carte: '#FFFFFF',
  bord: '#E0DAF7',
  risque: '#B42318',
  risqueClair: '#FDECEA',
  attention: '#8A5A00',
  attentionClair: '#FFF4D6',
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ backgroundColor: C.fond }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <ConnectionBanner />
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title} accessibilityRole="header">{children}</Text>;
}

export function Label({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.label, muted && { color: C.secondaire }]}>{children}</Text>;
}

export function Hero({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <View style={[s.card, { backgroundColor: C.marine, borderColor: C.marine }]}>
      <Text style={{ color: C.lavande, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700' }}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.menthe }} importantForAccessibility="no" />
        <View style={{ flex: 1, gap: 4 }}>{children}</View>
      </View>
    </View>
  );
}

/** Texte clair à placer dans un Hero. */
export function HeroText({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <Text style={{ color: strong ? C.menthe : C.lavande, fontSize: 16, fontWeight: strong ? '700' : '400' }}>{children}</Text>;
}

export function Card({ children, tone }: { children: ReactNode; tone?: 'ok' | 'risque' | 'attention' }) {
  const bg = tone === 'risque' ? C.risqueClair : tone === 'attention' ? C.attentionClair : tone === 'ok' ? C.mentheClair : C.carte;
  return <View style={[s.card, { backgroundColor: bg }]}>{children}</View>;
}

/** Statut lisible par icône ET libellé (pas seulement par la couleur). */
export function Status({ tone, children }: { tone: 'ok' | 'risque' | 'attention'; children: ReactNode }) {
  const icon = tone === 'ok' ? '✓' : tone === 'risque' ? '⚠' : 'ⓘ';
  const color = tone === 'ok' ? C.mentheTexte : tone === 'risque' ? C.risque : C.attention;
  return (
    <Text style={[s.status, { color }]} accessibilityRole="text">
      <Text importantForAccessibility="no">{icon} </Text>
      {children}
    </Text>
  );
}

export function Button({ label, onPress, variant = 'primaire', hint, disabled }: {
  label: string; onPress: () => void; variant?: 'primaire' | 'secondaire'; hint?: string; disabled?: boolean;
}) {
  const primary = variant === 'primaire';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, primary ? s.btnP : s.btnS, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, { color: primary ? '#fff' : C.texte }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[s.input, error ? { borderColor: C.risque } : null]} placeholderTextColor={C.secondaire} {...props} />
      {error ? <Text style={{ color: C.risque }} accessibilityLiveRegion="polite">⚠ {error}</Text> : null}
    </View>
  );
}

export function Choice<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              accessibilityLabel={o.label} style={[s.chip, on && { backgroundColor: C.marine, borderColor: C.marine }]}>
              <Text style={{ color: on ? '#fff' : C.texte, fontSize: 15 }}>{on ? '● ' : '○ '}{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ConnectionBanner() {
  const { status, refresh, repo } = useFinance();
  if (status !== 'connexion_requise') return null;
  return (
    <Card tone="attention">
      <Status tone="attention">Connexion requise. Le serveur ne répond pas.</Status>
      <Label muted>Votre saisie est conservée tant que l’application reste ouverte.</Label>
      {repo ? <Button label="Réessayer" variant="secondaire" onPress={refresh} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  // Sur le web, la barre d'onglets flotte en haut : on lui laisse la place.
  screen: { padding: 16, paddingTop: Platform.OS === 'web' ? 80 : 16, gap: 12, paddingBottom: 120 },
  title: { fontSize: 26, fontWeight: '700', color: C.texte },
  label: { fontSize: 16, color: C.texte },
  card: { borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: C.bord },
  status: { fontSize: 17, fontWeight: '600' },
  btn: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnP: { backgroundColor: C.marine },
  btnS: { backgroundColor: C.lavandeClair, borderWidth: 1, borderColor: C.lavande },
  btnText: { fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 15, color: C.secondaire },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.bord, borderRadius: 10, paddingHorizontal: 12, fontSize: 17, color: C.texte, backgroundColor: '#fff' },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: C.lavande, backgroundColor: '#fff' },
});
