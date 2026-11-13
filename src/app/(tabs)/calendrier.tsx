import { Aide } from '@/components/aide';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PlannedActions } from '@/components/planned-actions';
import { C, Card, Choice, Label, Screen, Status, SummaryCard } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { forecast, formatDateCourt, formatDateFr, formatFcfa, monthEndOutlook, type ForecastEvent, type ForecastView } from '@/domain';
import { itemIcon } from '@/lib/categories';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Ligne du calendrier : pastille de date, icône, libellé, montant (vert pour l'argent qui arrive). */
function DayRow({ e, highlight, onPress, expanded }: { e: ForecastEvent; highlight: boolean; onPress?: () => void; expanded?: boolean }) {
  const [, m, d] = e.date.split('-').map(Number);
  const income = e.item.kind === 'rentree';
  const negative = e.total < 0;
  const tinted = highlight || negative;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${d} ${MOIS[m - 1]}, ${e.item.label}, ${income ? 'plus' : 'moins'} ${formatFcfa(e.item.amount)}${negative ? `. Il vous manquera ${formatFcfa(-e.total)}` : ''}`}
      accessibilityState={onPress ? { expanded } : undefined}
      style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: tinted ? 'transparent' : C.bord,
        backgroundColor: negative ? C.risqueClair : highlight ? C.mentheClair : '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 50, paddingVertical: 6, borderRadius: 12, alignItems: 'center', backgroundColor: tinted ? 'rgba(255,255,255,0.7)' : C.lavandeClair }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: C.texte }}>{d}</Text>
          <Text style={{ fontSize: 12, color: C.texte }}>{MOIS_COURT[m - 1]}</Text>
        </View>
        <Ionicons name={itemIcon(e.item.label, e.item.category, e.item.kind, e.item.source)} size={22} color={C.texte} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.texte }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{e.item.label}</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: income ? C.mentheTexte : C.texte }}>
            {income ? '+' : '−'}{formatFcfa(e.item.amount)}
          </Text>
        </View>
      </View>
      {e.overdue || negative ? (
        <Text style={{ fontSize: 14, color: C.risque, fontWeight: '600' }}>
          {e.overdue ? 'En retard. ' : ''}{negative ? `Ce jour-là, il vous manquera ${formatFcfa(-e.total)}.` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function Calendrier() {
  const { snapshot } = useFinance();
  const [view, setView] = useState<ForecastView>('standard');
  const [opened, setOpened] = useState<string | null>(null);
  const [, m0] = (snapshot?.today ?? '2026-01-01').split('-').map(Number);
  const subtitle = `${MOIS[m0 - 1][0].toUpperCase()}${MOIS[m0 - 1].slice(1)} ${(snapshot?.today ?? '').slice(0, 4)}`;
  if (!snapshot) return <Screen title="Calendrier" subtitle={subtitle}><Label muted>Chargement…</Label></Screen>;

  // Prévision arrêtée à la fin du mois ; le début du mois suivant n'est compté que pour ce qu'il faut garder.
  const fc = forecast(snapshot, view);
  const out = monthEndOutlook(snapshot, view);
  const events = fc.events.filter((e) => e.date <= out.end);
  // Seules les échéances saisies à la main se confirment ici (dettes, épargne et factures du mois ont leur écran).
  const own = new Set(snapshot.planned.map((p) => p.id));
  const lowest = out.lowest;
  const nextMonth = MOIS[Number(out.earlyNext.until.slice(5, 7)) - 1];

  return (
    <Screen title="Calendrier" subtitle={subtitle} help={<Aide k="agenda" size={26} />}>
      <Choice label="" value={view} onChange={setView}
        options={[{ value: 'standard', label: 'Prévu' }, { value: 'prudente', label: 'Prudent' }]} />
      {view === 'prudente' ? <Label muted>Prudent : sans l’argent attendu, au cas où il n’arriverait pas à temps.</Label> : null}

      {fc.lateIncomes.map((i) => (
        <Card key={i.id} tone="attention">
          <Status tone="attention">« {i.label} » ({formatFcfa(i.amount)}) devait arriver le {formatDateFr(i.date)}. Il n’est plus compté tant que vous ne l’avez pas reçu.</Status>
          {own.has(i.id) ? <PlannedActions item={i} /> : null}
        </Card>
      ))}

      {events.length === 0 ? <Label muted>Rien de prévu d’ici la fin du mois.</Label> : null}
      {events.map((e, idx) => {
        const actionable = own.has(e.item.id) && (e.item.kind === 'rentree' || e.date <= snapshot.today);
        return (
          <View key={e.item.id} style={{ gap: 8 }}>
            <DayRow e={e} highlight={idx === 0} expanded={opened === e.item.id}
              onPress={actionable ? () => setOpened(opened === e.item.id ? null : e.item.id) : undefined} />
            {actionable && opened === e.item.id ? <Card><PlannedActions item={e.item} /></Card> : null}
          </View>
        );
      })}

      <SummaryCard label={`Le ${formatDateFr(out.end)}, vous aurez`} amount={`${formatFcfa(out.endBalance)} CFA`}
        tone={out.endBalance < 0 ? 'rouge' : 'lavande'} icon="flag-outline">
        <Text style={{ fontSize: 15, color: C.secondaire }}>
          Aujourd’hui : {formatFcfa(fc.start.total)}.{lowest && lowest.total < out.endBalance
            ? ` Au plus bas : ${formatFcfa(lowest.total)} le ${formatDateCourt(lowest.date)}.` : ''}
          {lowest && lowest.total < 0 ? ' Il faudra trouver de l’argent ou reporter une dépense.' : ''}
        </Text>
      </SummaryCard>

      {out.earlyNext.items.length ? (
        <Card tone={out.free < 0 ? 'risque' : undefined}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.texte }}>À garder pour début {nextMonth}</Text>
          <Text style={{ fontSize: 14, color: C.secondaire }}>
            {out.earlyNext.payday ? `À payer avant votre paie du ${formatDateCourt(out.earlyNext.payday.date)}` : `À payer d’ici le ${formatDateCourt(out.earlyNext.until)}`}
          </Text>
          {out.earlyNext.items.map((i) => (
            <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 15, color: C.texte }} numberOfLines={1}>{formatDateCourt(i.date)} · {i.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.texte }}>−{formatFcfa(i.amount)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: C.bord }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.texte }}>{out.free < 0 ? 'Il vous manquera' : 'Il vous restera vraiment'}</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: out.free < 0 ? C.risque : C.mentheTexte }}>{formatFcfa(Math.abs(out.free))}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
