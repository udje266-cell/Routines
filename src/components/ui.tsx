import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFinance } from '@/data/finance-context';

/**
 * Système visuel de Mes Finances, d'après les maquettes validées :
 * fond lavande très clair, grands titres, cartes teintées (lavande pour les montants, menthe pour le positif),
 * actions en violet, texte marine (couleur du logo). Rouge et ambre réservés aux alertes, toujours avec icône et libellé.
 */
export const C = {
  violet: '#5B3FA0',
  violetPresse: '#4A3285',
  violetClair: '#ECE6FA',
  marine: '#1E183B',
  marineDoux: '#2E2757',
  lavande: '#D9D1FB',
  lavandeClair: '#F1EDFD',
  menthe: '#8EE3C8',
  mentheVif: '#3FD3A0',
  mentheClair: '#D9F6EC',
  /** Menthe foncée pour du texte sur fond clair (contraste ≥ 4,5:1). */
  mentheTexte: '#12704F',
  texte: '#1E183B',
  secondaire: '#5B5675',
  fond: '#F8F6FD',
  carte: '#FFFFFF',
  bord: '#E4DEF6',
  risque: '#B42318',
  risqueClair: '#FDECEA',
  attention: '#8A5A00',
  attentionClair: '#FDF0D5',
};

type Icon = keyof typeof Ionicons.glyphMap;

/**
 * Écran défilant. Avec `title`, affiche un grand titre (écrans d'onglets, sans barre d'en-tête)
 * et respecte la barre d'état du téléphone.
 */
export function Screen({ children, title, subtitle, help }: { children: ReactNode; title?: string; subtitle?: string; help?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: C.fond }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[s.screen, title ? { paddingTop: insets.top + 12 } : null]}>
      {title ? (
        <View style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.bigTitle} accessibilityRole="header">{title}</Text>
            {help}
          </View>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
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

/** Montant en très gros (« 15 000 F CFA »). */
export function BigAmount({ children, color, compact }: { children: ReactNode; color?: string; compact?: boolean }) {
  return (
    <Text style={[s.big, compact && { fontSize: 28 }, color ? { color } : null]} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
      {children}
    </Text>
  );
}

/** Carte de synthèse teintée : un libellé, un grand montant, une ligne d'explication. */
export function SummaryCard({ label, amount, tone = 'lavande', icon, children, help }: {
  label: string; amount: string; tone?: 'lavande' | 'menthe' | 'ambre' | 'rouge'; icon?: Icon; children?: ReactNode; help?: ReactNode;
}) {
  const bg = { lavande: C.violetClair, menthe: C.mentheClair, ambre: C.attentionClair, rouge: C.risqueClair }[tone];
  const fg = tone === 'rouge' ? C.risque : C.texte;
  return (
    <View style={[s.summary, { backgroundColor: bg }]} accessible accessibilityLabel={`${label} : ${amount}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon ? (
          <View style={[s.iconBox, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
            <Ionicons name={icon} size={26} color={tone === 'rouge' ? C.risque : tone === 'ambre' ? C.attention : C.violet} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.summaryLabel, { color: fg, flexShrink: 1 }]}>{label}</Text>
            {help}
          </View>
          <BigAmount color={fg} compact={!!icon}>{amount}</BigAmount>
        </View>
      </View>
      {children ? <View style={{ gap: 4 }}>{children}</View> : null}
    </View>
  );
}

/** Ancienne carte « héros », désormais au style des maquettes (lavande). */
export function Hero({ label, value, children, help }: { label: string; value: string; children?: ReactNode; help?: ReactNode }) {
  return <SummaryCard label={label} amount={value} help={help}>{children}</SummaryCard>;
}

export function HeroText({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <Text style={{ color: strong ? C.violet : C.secondaire, fontSize: 15, fontWeight: strong ? '700' : '400' }}>{children}</Text>;
}

export function Card({ children, tone }: { children: ReactNode; tone?: 'ok' | 'risque' | 'attention' }) {
  const bg = tone === 'risque' ? C.risqueClair : tone === 'attention' ? C.attentionClair : tone === 'ok' ? C.mentheClair : C.carte;
  return <View style={[s.card, { backgroundColor: bg, borderColor: tone ? 'transparent' : C.bord }]}>{children}</View>;
}

/** Statut lisible par icône ET libellé (pas seulement par la couleur). */
export function Status({ tone, children }: { tone: 'ok' | 'risque' | 'attention'; children: ReactNode }) {
  const icon: Icon = tone === 'ok' ? 'checkmark-circle' : tone === 'risque' ? 'warning' : 'information-circle';
  const color = tone === 'ok' ? C.mentheTexte : tone === 'risque' ? C.risque : C.attention;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={color} style={{ marginTop: 1 }} importantForAccessibility="no" />
      <Text style={[s.status, { color, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primaire', hint, disabled, icon }: {
  label: string; onPress: () => void; variant?: 'primaire' | 'secondaire' | 'lien'; hint?: string; disabled?: boolean; icon?: Icon;
}) {
  const primary = variant === 'primaire';
  const link = variant === 'lien';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, primary ? s.btnP : link ? null : s.btnS, pressed && primary && { backgroundColor: C.violetPresse },
        (pressed || disabled) && !primary && { opacity: 0.6 }, disabled && primary && { opacity: 0.5 }]}>
      {icon ? <Ionicons name={icon} size={20} color={primary ? '#fff' : C.violet} /> : null}
      <Text style={[s.btnText, { color: primary ? '#fff' : C.violet }, link && { textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

/** Ligne de liste : icône dans un carré arrondi, titre, sous-titre, valeur à droite, flèche si cliquable. */
export function Row({ icon, title, sub, value, valueColor, onPress, tone }: {
  icon?: Icon; title: string; sub?: string; value?: string; valueColor?: string; onPress?: () => void; tone?: 'menthe' | 'lavande';
}) {
  const body = (
    <View style={[s.row, tone === 'menthe' && { backgroundColor: C.mentheClair, borderColor: 'transparent' }]}>
      {icon ? (
        <View style={[s.iconBox, { backgroundColor: tone === 'menthe' ? 'rgba(255,255,255,0.6)' : C.lavandeClair }]}>
          <Ionicons name={icon} size={22} color={C.violet} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[s.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={20} color={C.secondaire} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, sub, value].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

/** Pastille (« À revoir le 13 nov. », « 10 000 F CFA »). */
export function Pill({ children, tone = 'menthe' }: { children: ReactNode; tone?: 'menthe' | 'lavande' }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: tone === 'menthe' ? C.mentheClair : C.violetClair }}>
      <Text style={{ color: C.texte, fontWeight: '700', fontSize: 15 }}>{children}</Text>
    </View>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label: string; error?: string | null; icon?: Icon }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={[s.inputBox, error ? { borderColor: C.risque } : null]}>
        {icon ? <Ionicons name={icon} size={20} color={C.secondaire} /> : null}
        <TextInput accessibilityLabel={label || props.placeholder} style={s.input} placeholderTextColor={C.secondaire} {...props} />
      </View>
      {error ? <Text style={{ color: C.risque }} accessibilityLiveRegion="polite">⚠ {error}</Text> : null}
    </View>
  );
}

/** Choix : sélecteur à onglets pour 2 ou 3 options courtes, pastilles au-delà. */
export function Choice<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const segmented = options.length <= 3;
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={segmented ? s.segment : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              style={[segmented ? s.segItem : s.chip, on && { backgroundColor: C.violet, borderColor: C.violet }]}>
              <Text style={{ color: on ? '#fff' : C.texte, fontSize: 15, fontWeight: on ? '700' : '500', textAlign: 'center' }} numberOfLines={2}>{o.label}</Text>
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
      <Status tone="attention">Pas de connexion Internet. Vérifiez votre réseau.</Status>
      <Label muted>Ce que vous avez saisi est gardé tant que l’application reste ouverte.</Label>
      {repo ? <Button label="Réessayer" variant="secondaire" onPress={refresh} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  screen: { padding: 20, gap: 14, paddingBottom: 40 },
  bigTitle: { fontSize: 34, fontWeight: '800', color: C.texte, letterSpacing: -0.5 },
  subtitle: { fontSize: 20, color: C.secondaire, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800', color: C.texte },
  label: { fontSize: 16, color: C.texte, lineHeight: 22 },
  big: { fontSize: 34, fontWeight: '800', color: C.texte, letterSpacing: -0.5 },
  summary: { borderRadius: 20, padding: 20, gap: 10 },
  summaryLabel: { fontSize: 17, fontWeight: '600' },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: C.bord, backgroundColor: C.carte },
  status: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  btn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnP: { backgroundColor: C.violet },
  btnS: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.violet },
  btnText: { fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.bord, backgroundColor: C.carte },
  rowTitle: { fontSize: 17, fontWeight: '700', color: C.texte },
  rowSub: { fontSize: 15, color: C.secondaire, marginTop: 2 },
  rowValue: { fontSize: 17, fontWeight: '700', color: C.texte },
  fieldLabel: { fontSize: 16, color: C.texte, fontWeight: '700' },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderWidth: 1, borderColor: C.bord, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#fff' },
  input: { flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, fontSize: 17, color: C.texte, paddingVertical: 10 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: C.bord, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 1, borderColor: 'transparent' },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: C.bord, backgroundColor: '#fff' },
});
