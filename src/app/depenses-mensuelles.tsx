import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Label, Screen, Status, Title } from '@/components/ui';
import { AmountField, DateField, DayOfMonthField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import {
  addDays, formatDateFr, formatFcfa, monthlyFixedTotal, parseFcfa, ruleOccurrences,
  type RecurringOccurrence, type RecurringRule,
} from '@/domain';

export default function DepensesMensuelles() {
  const { snapshot } = useFinance();
  if (!snapshot) return <Screen><Title>Dépenses du mois</Title></Screen>;
  const rules = (snapshot.recurring ?? []).filter((r) => !r.end || r.end >= snapshot.today);
  const stopped = (snapshot.recurring ?? []).filter((r) => r.end && r.end < snapshot.today);
  const total = monthlyFixedTotal(rules, snapshot.today);
  const income = rules.filter((r) => r.kind === 'rentree').reduce((s, r) => s + r.amount, 0);

  return (
    <Screen>
      <Title>Dépenses du mois</Title>
      <Card tone="ok">
        <Label muted>Dépenses obligatoires chaque mois</Label>
        <Title>{formatFcfa(total)}</Title>
        {income ? <Label>Revenus mensuels enregistrés : {formatFcfa(income)} · reste après charges fixes : {formatFcfa(income - total)}</Label> : null}
        <Label muted>Elles entrent automatiquement dans la prévision, le simulateur d’achat et l’épargne recommandée.</Label>
      </Card>
      <Button label="Ajouter une dépense mensuelle" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'mensuelle' } })} />
      {rules.length === 0 ? <Label muted>Ajoutez votre loyer, l’électricité (CIE), l’eau (SODECI), internet, la tontine, la scolarité…</Label> : null}
      {rules.map((r) => <RuleCard key={r.id} rule={r} />)}
      {stopped.length ? <Label muted>Arrêtées : {stopped.map((r) => r.label).join(', ')}</Label> : null}
    </Screen>
  );
}

function RuleCard({ rule }: { rule: RecurringRule }) {
  const { snapshot } = useFinance();
  const today = snapshot!.today;
  const w = useWrite('mensuelle');
  const [editing, setEditing] = useState<null | 'suivantes'>(null);
  const [amount, setAmount] = useState(String(rule.amount));
  const [day, setDay] = useState(String(rule.day));
  const wallet = snapshot!.wallets.find((x) => x.id === rule.walletId)?.name ?? '';
  // Occurrences : la dernière non réglée du mois passé (si en retard) puis les trois prochaines.
  const occ = ruleOccurrences(rule, addDays(today, -31), addDays(today, 100)).filter((o) => !o.settled || o.date >= today).slice(0, 4);
  const next = occ.find((o) => !o.settled);

  async function saveFollowing() {
    const v = parseFcfa(amount);
    const d = Number(day);
    if (!v || !(d >= 1 && d <= 31)) return w.setError('Montant et jour (1 à 31) requis.');
    if (!next) return;
    if (await w.run((r) => r.splitRecurring(rule.id, next.original, { amount: v, day: d, label: rule.label, walletId: rule.walletId }))) setEditing(null);
  }

  return (
    <Card>
      <Label>{rule.label} · {rule.kind === 'rentree' ? '+' : '−'}{formatFcfa(rule.amount)} le {rule.day} de chaque mois</Label>
      <Label muted>{wallet}{rule.category ? ` · ${rule.category}` : ''}{rule.day > 28 ? ' · ramené au dernier jour des mois courts' : ''}</Label>
      {occ.map((o) => <OccurrenceRow key={o.original} rule={rule} occ={o} payable={!o.settled && (o.date <= today || o.original === next?.original)} />)}
      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      {editing ? (
        <>
          <AmountField label="Nouveau montant (F)" value={parseFcfa(amount)} onChange={(v) => setAmount(v === null ? '' : String(v))} />
          <DayOfMonthField label="Nouveau jour" value={Number(day) || 1} onChange={(d) => setDay(String(d))} />
          <Label muted>S’applique à partir de l’échéance du {next ? formatDateFr(next.date) : '—'}. Les mois précédents ne changent pas.</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Enregistrer" disabled={w.busy} onPress={saveFollowing} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Fermer" onPress={() => setEditing(null)} /></View>
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button variant="secondaire" label="Modifier les suivantes" disabled={!next} onPress={() => setEditing('suivantes')} /></View>
          <View style={{ flex: 1 }}>
            <Button variant="secondaire" label="Arrêter" hint={`Plus de ${rule.label} après aujourd’hui`} disabled={w.busy}
              onPress={() => w.run((r) => r.stopRecurring(rule.id, addDays(today, -1) < rule.start ? rule.start : addDays(today, -1)))} />
          </View>
        </View>
      )}
    </Card>
  );
}

function OccurrenceRow({ rule, occ, payable }: { rule: RecurringRule; occ: RecurringOccurrence; payable: boolean }) {
  const { snapshot } = useFinance();
  const today = snapshot!.today;
  const pay = useWrite('reglement-mensuel');
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(String(occ.amount));
  const [date, setDate] = useState(occ.date);
  const late = !occ.settled && occ.date < today;
  const changed = rule.overrides[occ.original];

  async function saveOne() {
    const v = parseFcfa(amount);
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return pay.setError('Montant et date (AAAA-MM-JJ) requis.');
    if (await pay.run((r) => r.setOccurrence(rule.id, occ.original, { date, amount: v }))) setEdit(false);
  }

  return (
    <View style={{ gap: 6, paddingTop: 6 }}>
      {occ.settled ? (
        <Status tone="ok">{formatDateFr(occ.date)} · {formatFcfa(occ.amount)} · {rule.kind === 'rentree' ? 'reçu' : 'payé'}</Status>
      ) : late ? (
        <Status tone="risque">{formatDateFr(occ.date)} · {formatFcfa(occ.amount)} · en retard, à couvrir aujourd’hui</Status>
      ) : (
        <Label>{formatDateFr(occ.date)} · {formatFcfa(occ.amount)}{changed ? ' · modifiée' : ''}</Label>
      )}
      {pay.error ? <Status tone="risque">{pay.error}</Status> : null}
      {edit ? (
        <>
          <AmountField label="Montant pour ce mois (F)" value={parseFcfa(amount)} onChange={(v) => setAmount(v === null ? '' : String(v))} />
          <DateField label="Date pour ce mois" value={date} onChange={setDate} today={today} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Enregistrer" disabled={pay.busy} onPress={saveOne} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Sauter ce mois" disabled={pay.busy}
              onPress={() => pay.run((r) => r.setOccurrence(rule.id, occ.original, { skip: true }))} /></View>
          </View>
        </>
      ) : !occ.settled ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {payable ? <View style={{ flex: 1 }}>
            <Button label={rule.kind === 'rentree' ? 'Reçu' : 'Payé'} hint={`${rule.label} du ${formatDateFr(occ.date)}, ${formatFcfa(occ.amount)}`}
              disabled={pay.busy}
              onPress={() => pay.run((r, clientKey) => r.settleOccurrence({
                clientKey, ruleId: rule.id, original: occ.original, amount: occ.amount, walletId: rule.walletId, date: occ.date < today ? occ.date : today,
              }))} />
          </View> : null}
          <View style={{ flex: 1 }}><Button variant="secondaire" label="Modifier ce mois" onPress={() => setEdit(true)} /></View>
        </View>
      ) : null}
    </View>
  );
}
