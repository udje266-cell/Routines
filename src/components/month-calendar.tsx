import { Aide } from '@/components/aide';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { addDays, formatDateFr, formatFcfa, type CivilDate, type DayEntry, type MonthPlan } from '@/domain';
import { itemIcon } from '@/lib/categories';

import { C } from './ui';

const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const JOURS_GRILLE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dayList(start: CivilDate, end: CivilDate): CivilDate[] {
  const out: CivilDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Points sous un jour : vert si de l'argent arrive, rouge s'il en part (forme différente pour ne pas dépendre de la couleur). */
function Dots({ entries }: { entries?: DayEntry[] }) {
  const inn = entries?.some((e) => e.kind === 'entree');
  const out = entries?.some((e) => e.kind === 'sortie');
  return (
    <View style={{ flexDirection: 'row', gap: 3, height: 8, justifyContent: 'center' }} importantForAccessibility="no">
      {inn ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.mentheVif }} /> : null}
      {out ? <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: C.risque }} /> : null}
    </View>
  );
}

function describe(d: CivilDate, entries?: DayEntry[]) {
  const inn = (entries ?? []).filter((e) => e.kind === 'entree').reduce((s, e) => s + e.amount, 0);
  const out = (entries ?? []).filter((e) => e.kind === 'sortie').reduce((s, e) => s + e.amount, 0);
  return `${formatDateFr(d)}${inn ? `, entrée ${formatFcfa(inn)}` : ''}${out ? `, sortie ${formatFcfa(out)}` : ''}`;
}

/**
 * Calendrier du mois façon Flo : bande des jours qui défile (aujourd'hui entouré de menthe, jour choisi en violet),
 * points d'entrée et de sortie, grille complète à la demande. Toucher un jour pour voir et planifier.
 */
export function MonthCalendar({ plan, today, selected, onSelect }: {
  plan: MonthPlan; today: CivilDate; selected: CivilDate; onSelect: (d: CivilDate) => void;
}) {
  const [grid, setGrid] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const days = dayList(plan.start, plan.end);
  const [, m] = plan.start.split('-').map(Number);

  // Faire apparaître aujourd'hui dans la bande au premier affichage.
  useEffect(() => {
    const i = days.indexOf(today);
    if (i > 2) setTimeout(() => scroller.current?.scrollTo({ x: (i - 2) * 52, animated: false }), 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cell = (d: CivilDate, size: number) => {
    const sel = d === selected;
    const isToday = d === today;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: sel ? C.violet : isToday ? C.mentheClair : 'transparent', borderWidth: isToday && !sel ? 2 : 0, borderColor: C.mentheVif }}>
        <Text style={{ fontSize: 16, fontWeight: sel || isToday ? '800' : '600', color: sel ? '#fff' : C.texte }}>{Number(d.slice(8))}</Text>
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.texte }}>{MOIS[m - 1][0].toUpperCase() + MOIS[m - 1].slice(1)}</Text>
        <Pressable onPress={() => setGrid(!grid)} accessibilityRole="button" accessibilityState={{ expanded: grid }} hitSlop={10}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: C.violet, fontWeight: '700' }}>{grid ? 'Réduire' : 'Voir le mois'}</Text>
          <Ionicons name={grid ? 'chevron-up' : 'chevron-down'} size={18} color={C.violet} />
        </Pressable>
      </View>

      {grid ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 18, padding: 8, borderWidth: 1, borderColor: C.bord }}>
          {JOURS_GRILLE.map((j, i) => (
            <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', color: C.secondaire, fontWeight: '700', paddingVertical: 4 }}>{j}</Text>
          ))}
          {Array.from({ length: (new Date(`${plan.start}T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
            <View key={`v${i}`} style={{ width: `${100 / 7}%` }} />
          ))}
          {days.map((d) => (
            <Pressable key={d} onPress={() => onSelect(d)} accessibilityRole="button" accessibilityLabel={describe(d, plan.days[d])}
              accessibilityState={{ selected: d === selected }} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, gap: 2 }}>
              {cell(d, 36)}
              <Dots entries={plan.days[d]} />
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
          {days.map((d) => (
            <Pressable key={d} onPress={() => onSelect(d)} accessibilityRole="button" accessibilityLabel={describe(d, plan.days[d])}
              accessibilityState={{ selected: d === selected }} style={{ width: 48, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.secondaire, fontWeight: '600' }}>{JOURS[new Date(`${d}T00:00:00Z`).getUTCDay()]}</Text>
              {cell(d, 42)}
              <Dots entries={plan.days[d]} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Ce qui est prévu le jour choisi, et de quoi y planifier une entrée ou une sortie. */
export function DayPanel({ day, today, entries }: { day: CivilDate; today: CivilDate; entries: DayEntry[] }) {
  const title = day === today ? 'Aujourd’hui' : day === addDays(today, 1) ? 'Demain' : formatDateFr(day);
  const future = day > today;
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.bord, padding: 14, gap: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.texte }}>{title}</Text>
      {entries.length === 0 ? (
        <Text style={{ fontSize: 15, color: C.secondaire }}>{future ? 'Rien de prévu ce jour-là.' : 'Rien ce jour-là.'}</Text>
      ) : null}
      {entries.map((e) => (
        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={itemIcon(e.label, e.category, e.kind === 'entree' ? 'rentree' : 'sortie')} size={22} color={C.texte} />
          <Text style={{ flex: 1, fontSize: 16, color: C.texte }} numberOfLines={1}>{e.label}{e.done ? '' : ' · prévu'}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: e.kind === 'entree' ? C.mentheTexte : C.texte }}>
            {e.kind === 'entree' ? '+' : '−'}{formatFcfa(e.amount)}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['entree', 'sortie'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button"
            accessibilityLabel={`${k === 'entree' ? 'Ajouter une entrée d’argent' : 'Ajouter une sortie d’argent'} le ${formatDateFr(day)}`}
            onPress={() => router.push({ pathname: '/ajouter', params: { type: k === 'entree' ? 'revenu' : 'depense', date: day } })}
            style={{ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
              backgroundColor: k === 'entree' ? C.mentheClair : C.violetClair }}>
            <Ionicons name={k === 'entree' ? 'add-circle-outline' : 'remove-circle-outline'} size={20} color={C.texte} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.texte }}>{k === 'entree' ? 'Entrée' : 'Sortie'}</Text>
          </Pressable>
        ))}
      </View>
      {future ? (
        <Pressable onPress={() => router.push({ pathname: '/ajouter', params: { type: 'mensuelle', date: day } })} accessibilityRole="button">
          <Text style={{ color: C.violet, fontWeight: '700', fontSize: 15 }}>↻ Chaque mois à cette date (loyer, salaire, tontine…)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Le plan du mois et le conseil d'épargne, en clair. */
export function PlanCard({ plan }: { plan: MonthPlan }) {
  const a = plan.advice;
  const short = plan.left < 0;
  return (
    <View style={{ backgroundColor: short ? C.risqueClair : C.violetClair, borderRadius: 20, padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.texte }}>Mon plan du mois</Text>
        <Aide k="plan" />
      </View>
      {[
        ['Entrées prévues', `+${formatFcfa(plan.income)}`, C.mentheTexte],
        ['Sorties prévues', `−${formatFcfa(plan.expenses)}`, C.texte],
        ['Il reste', formatFcfa(plan.left), short ? C.risque : C.texte],
      ].map(([l, v, col], i) => (
        <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: i === 2 ? 8 : 0, borderTopWidth: i === 2 ? 1 : 0, borderTopColor: 'rgba(30,24,59,0.15)' }}>
          <Text style={{ fontSize: 16, color: C.texte, fontWeight: i === 2 ? '800' : '400' }}>{l}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: col }}>{v}</Text>
        </View>
      ))}
      {a.cashGap && plan.left >= 0 ? (
        <View style={{ backgroundColor: C.attentionClair, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8 }}>
          <Ionicons name="warning" size={20} color={C.attention} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.attention }}>
            Attention au calendrier : l’argent arrive après certaines factures. Il manquera {formatFcfa(a.cashGap.amount)} avant la paie.
          </Text>
        </View>
      ) : null}
      {a.save > 0 ? (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 12, gap: 2 }}>
          <Text style={{ fontSize: 15, color: C.secondaire }}>À mettre de côté ce mois-ci</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.texte }}>{formatFcfa(a.save)} CFA</Text>
          <Text style={{ fontSize: 15, color: C.texte }}>le {formatDateFr(a.saveOn)}</Text>
        </View>
      ) : null}
      {a.steps.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.violet }}>{i + 1}.</Text>
          <Text style={{ flex: 1, fontSize: 15, color: C.texte, lineHeight: 21 }}>{t}</Text>
        </View>
      ))}
      {a.save > 0 ? (
        <Pressable onPress={() => router.push('/epargne')} accessibilityRole="button"
          style={{ minHeight: 48, borderRadius: 14, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Mettre de côté</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
