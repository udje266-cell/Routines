import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addDays, type CivilDate, daysInMonth, formatDateFr, formatFcfa } from '@/domain';

import { C } from './ui';

/**
 * Saisies uniformes de Mes Finances :
 * - montants : clavier numérique seul, mise en forme « 30 000 » en direct, jamais de lettres ;
 * - dates : calendrier aux couleurs de l'application, jamais de saisie au clavier ;
 * - jour du mois : grille 1 à 31.
 */

const digits = (t: string) => t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
// Espace insécable normale : l'espace fine est presque invisible dans un champ de saisie.
const group = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

export function AmountField({ label, value, onChange, error, autoFocus, hint }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  error?: string | null;
  autoFocus?: boolean;
  hint?: string;
}) {
  const text = value === null ? '' : group(String(value));
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.amountBox, error ? { borderColor: C.risque } : null]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          value={text}
          onChangeText={(t) => {
            const d = digits(t);
            onChange(d ? Number(d) : null);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          // Sur le web, la mise au point pendant l'animation d'ouverture décale la page.
          autoFocus={autoFocus && Platform.OS !== 'web'}
          placeholder="0"
          placeholderTextColor={C.secondaire}
          style={s.amountInput}
          maxLength={16}
        />
        <Text style={s.currency} importantForAccessibility="no">F CFA</Text>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error} accessibilityLiveRegion="polite">⚠ {error}</Text> : null}
    </View>
  );
}

/** Petit nombre entier (durée en mois, pourcentage…) : clavier numérique, chiffres seulement. */
export function NumberField({ label, value, onChange, suffix, decimals }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; decimals?: boolean;
}) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.amountBox}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(t) => onChange(decimals ? t.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '') : t.replace(/\D/g, ''))}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          inputMode={decimals ? 'decimal' : 'numeric'}
          style={[s.amountInput, { fontSize: 20 }]}
          placeholder="0"
          placeholderTextColor={C.secondaire}
        />
        {suffix ? <Text style={s.currency} importantForAccessibility="no">{suffix}</Text> : null}
      </View>
    </View>
  );
}

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n: number) => String(n).padStart(2, '0');

export function DateField({ label, value, onChange, today, min, max }: {
  label: string;
  value: CivilDate;
  onChange: (d: CivilDate) => void;
  today: CivilDate;
  min?: CivilDate;
  max?: CivilDate;
}) {
  const [open, setOpen] = useState(false);
  const [y0, m0] = value.split('-').map(Number);
  const [ym, setYm] = useState({ y: y0, m: m0 });
  const allowed = (d: CivilDate) => (!min || d >= min) && (!max || d <= max);
  const relative = value === today ? 'Aujourd’hui' : value === addDays(today, 1) ? 'Demain' : value === addDays(today, -1) ? 'Hier' : null;

  const first = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay(); // 0 = dimanche
  const offset = (first + 6) % 7;
  const n = daysInMonth(ym.y, ym.m);
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  const move = (k: number) => setYm(({ y, m }) => (m + k === 0 ? { y: y - 1, m: 12 } : m + k === 13 ? { y: y + 1, m: 1 } : { y, m: m + k }));
  const pick = (d: CivilDate) => {
    if (!allowed(d)) return;
    onChange(d);
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          setYm({ y: y0, m: m0 });
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${formatDateFr(value)}. Ouvrir le calendrier`}
        style={s.dateBtn}>
        <Ionicons name="calendar-outline" size={24} color={C.texte} />
        <Text style={s.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{relative ?? formatDateFr(value)}</Text>
        <Ionicons name="chevron-forward" size={20} color={C.secondaire} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer le calendrier">
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle} accessibilityRole="header">{label}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['Aujourd’hui', today], ['Demain', addDays(today, 1)]].filter(([, d]) => allowed(d)).map(([t, d]) => (
                <Pressable key={t} onPress={() => pick(d)} style={s.quick} accessibilityRole="button" accessibilityLabel={t}>
                  <Text style={{ color: C.violet, fontWeight: '700' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.monthRow}>
              <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="Mois précédent" hitSlop={12} style={s.arrow}>
                <Ionicons name="chevron-back" size={24} color={C.violet} />
              </Pressable>
              <Text style={s.monthTitle}>{MOIS[ym.m - 1]} {ym.y}</Text>
              <Pressable onPress={() => move(1)} accessibilityRole="button" accessibilityLabel="Mois suivant" hitSlop={12} style={s.arrow}>
                <Ionicons name="chevron-forward" size={24} color={C.violet} />
              </Pressable>
            </View>
            <View style={s.grid}>
              {JOURS.map((j, i) => <Text key={i} style={s.dow} importantForAccessibility="no">{j}</Text>)}
              {cells.map((d, i) => {
                if (d === null) return <View key={`v${i}`} style={s.cell} />;
                const iso = `${ym.y}-${pad(ym.m)}-${pad(d)}`;
                const sel = iso === value;
                const isToday = iso === today;
                const ok = allowed(iso);
                return (
                  <Pressable key={iso} onPress={() => pick(iso)} disabled={!ok}
                    accessibilityRole="button" accessibilityLabel={formatDateFr(iso) + (isToday ? ', aujourd’hui' : '')}
                    accessibilityState={{ selected: sel, disabled: !ok }}
                    style={[s.cell, s.day, isToday && !sel && { borderColor: C.menthe, borderWidth: 2 }, sel && { backgroundColor: C.violet }]}>
                    <Text style={{ fontSize: 16, color: sel ? '#fff' : ok ? C.texte : '#C9C4DD', fontWeight: sel || isToday ? '700' : '400' }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Jour du mois (1 à 31) en grille ; 29, 30 et 31 tombent au dernier jour des mois courts. */
export function DayOfMonthField({ label, value, onChange }: { label: string; value: number; onChange: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label} : le ${value}. Choisir`} style={s.dateBtn}>
        <Ionicons name="calendar-outline" size={24} color={C.texte} />
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value === 1 ? 'Le 1er' : `Le ${value}`}</Text>
        <Ionicons name="chevron-forward" size={20} color={C.secondaire} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer">
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle} accessibilityRole="header">{label}</Text>
            <View style={s.grid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <Pressable key={d} onPress={() => { onChange(d); setOpen(false); }} accessibilityRole="button" accessibilityLabel={`Le ${d}`}
                  accessibilityState={{ selected: d === value }} style={[s.cell, s.day, d === value && { backgroundColor: C.violet }]}>
                  <Text style={{ fontSize: 16, color: d === value ? '#fff' : C.texte, fontWeight: d === value ? '700' : '400' }}>{d}</Text>
                </Pressable>
              ))}
            </View>
            {value > 28 ? <Text style={s.hint}>Les mois plus courts, ce sera le dernier jour du mois.</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

type Opt<T> = { value: T; label: string; icon: keyof typeof Ionicons.glyphMap; sub?: string };

/** Liste à cocher façon maquette : icône, libellé, rond de sélection ; la ligne choisie passe en menthe. */
function RadioList<T extends string>({ options, value, onChange }: { options: Opt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={o.sub ? `${o.label}, ${o.sub}` : o.label}
            style={[s.radioRow, on && { backgroundColor: C.mentheClair, borderColor: C.mentheVif, borderWidth: 2 }]}>
            <Ionicons name={o.icon} size={26} color={C.texte} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte }}>{o.label}</Text>
              {o.sub ? <Text style={{ fontSize: 14, color: C.secondaire }}>{o.sub}</Text> : null}
            </View>
            <View style={[s.radio, on && { borderColor: C.violet }]}>{on ? <View style={s.radioDot} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Choix d'une option : jusqu'à 5 options, liste à cocher visible ; au-delà, une ligne
 * « icône · libellé … valeur › » qui ouvre la liste en bas de l'écran (comme la maquette « Ajouter »).
 */
export function TileChoice<T extends string>({ label, options, value, onChange, rowIcon }: {
  label: string; options: Opt<T>[]; value: T; onChange: (v: T) => void; rowIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  if (options.length <= 5 && !rowIcon)
    return (
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        <Text style={s.label}>{label}</Text>
        <RadioList options={options} value={value} onChange={onChange} />
      </View>
    );
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label} : ${current?.label ?? 'à choisir'}. Changer`} style={s.dateBtn}>
        <Ionicons name={rowIcon ?? current?.icon ?? 'list-outline'} size={24} color={C.texte} />
        <Text style={s.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{current?.label ?? 'Choisir'}</Text>
        <Ionicons name="chevron-forward" size={20} color={C.secondaire} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer">
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle} accessibilityRole="header">{label}</Text>
            <ScrollView style={{ maxHeight: 460 }}>
              <RadioList options={options} value={value} onChange={(v) => { onChange(v); setOpen(false); }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export { formatFcfa };

const s = StyleSheet.create({
  label: { fontSize: 16, color: C.texte, fontWeight: '700' },
  rowLabel: { fontSize: 17, fontWeight: '700', color: C.texte, flexShrink: 0 },
  rowValue: { flex: 1, minWidth: 0, textAlign: 'right', fontSize: 17, color: C.texte },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.bord, backgroundColor: '#fff' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.bord, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.violet },
  hint: { fontSize: 14, color: C.secondaire },
  error: { color: C.risque, fontSize: 15 },
  amountBox: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderWidth: 1, borderColor: C.bord, borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 20 },
  // Largeur partant de 0 : sinon, sur le web, le champ garde une largeur intrinsèque et déborde de l'écran.
  amountInput: { flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, fontSize: 34, fontWeight: '800', color: C.texte, paddingVertical: 10 },
  currency: { fontSize: 26, color: C.texte, fontWeight: '800', marginLeft: 6 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, borderWidth: 1, borderColor: C.bord, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 16 },
  dateText: { flex: 1, fontSize: 17, color: C.texte, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,24,59,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.fond, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.texte },
  quick: { paddingHorizontal: 16, minHeight: 42, justifyContent: 'center', borderRadius: 21, backgroundColor: C.violetClair },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 18, fontWeight: '700', color: C.texte, textTransform: 'capitalize' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', color: C.secondaire, fontWeight: '600', paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
});
