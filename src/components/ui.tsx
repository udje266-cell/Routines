import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useFinance } from '@/data/finance-context';

/** Palette : repère vert menthe de Mes Finances. */
export const C = {
  // Bouton : menthe foncée pour garder un contraste suffisant avec le texte blanc.
  menthe: '#1F8A68',
  mentheLogo: '#8EE3C8',
  mentheClair: '#E4F7F0',
  marine: '#1E183B',
  lavande: '#D9D1FB',
  texte: '#1E183B',
  secondaire: '#5B5675',
  fond: '#F7F6FC',
  carte: '#FFFFFF',
  bord: '#DCD8EC',
  risque: '#B3261E',
  risqueClair: '#FBE9E7',
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

export function Card({ children, tone }: { children: ReactNode; tone?: 'ok' | 'risque' | 'attention' }) {
  const bg = tone === 'risque' ? C.risqueClair : tone === 'attention' ? C.attentionClair : tone === 'ok' ? C.mentheClair : C.carte;
  return <View style={[s.card, { backgroundColor: bg }]}>{children}</View>;
}

/** Statut lisible par icône ET libellé (pas seulement par la couleur). */
export function Status({ tone, children }: { tone: 'ok' | 'risque' | 'attention'; children: ReactNode }) {
  const icon = tone === 'ok' ? '✓' : tone === 'risque' ? '⚠' : 'ⓘ';
  const color = tone === 'ok' ? C.menthe : tone === 'risque' ? C.risque : C.attention;
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
              accessibilityLabel={o.label} style={[s.chip, on && { backgroundColor: C.menthe, borderColor: C.menthe }]}>
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
  screen: { padding: 16, gap: 12, paddingBottom: 120 },
  title: { fontSize: 26, fontWeight: '700', color: C.texte },
  label: { fontSize: 16, color: C.texte },
  card: { borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: C.bord },
  status: { fontSize: 17, fontWeight: '600' },
  btn: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnP: { backgroundColor: C.menthe },
  btnS: { backgroundColor: C.carte, borderWidth: 1, borderColor: C.bord },
  btnText: { fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 15, color: C.secondaire },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.bord, borderRadius: 10, paddingHorizontal: 12, fontSize: 17, color: C.texte, backgroundColor: '#fff' },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: C.bord, backgroundColor: '#fff' },
});
