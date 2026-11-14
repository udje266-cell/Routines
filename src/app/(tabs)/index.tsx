import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aide, VisiteGuidee } from '@/components/aide';
import { OperationLine } from '@/components/operation-line';
import { DayPanel, MonthCalendar, PlanCard } from '@/components/month-calendar';
import { CycleRing } from '@/components/ring';
import { Button, C, Card, Label, Row, Screen, Status, SummaryCard } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, advise, currentCycle, cycleDay, formatDateCourt, formatDateFr, formatFcfa, forecast, monthPlan } from '@/domain';
import { itemIcon } from '@/lib/categories';
import { confirmAction } from '@/lib/confirm';

const F = (n: number) => `${formatFcfa(n).replace(/ F$/, '')} F CFA`;

export default function Aujourdhui() {
  const { snapshot, status, repo, prefs, prefsLoaded, setPrefs } = useFinance();
  // Visite guidée à la première ouverture (et quand on la redemande depuis Plus).
  const tour = prefsLoaded && !prefs.tourSeen && !!snapshot;
  const endTour = () => void setPrefs({ ...prefs, tourSeen: true });
  const pay = useWrite('paiement-accueil');
  const today = snapshot?.today ?? '2026-01-01';
  const [selected, setSelected] = useState(today);

  if (!snapshot) {
    return (
      <Screen title="Aujourd’hui" subtitle={formatDateFr(today)}>
        <Label muted>{status === 'chargement' ? 'Chargement de votre budget…' : 'Budget indisponible pour le moment.'}</Label>
      </Screen>
    );
  }

  const cycle = currentCycle(snapshot);
  const { day, length } = cycleDay(today, cycle);
  const bills = forecast(snapshot).events.filter((e) => e.item.kind !== 'rentree').slice(0, 3);
  const tip = advise(snapshot)[0] ?? null;
  const paused = (snapshot.intents ?? []).filter((i) => i.status === 'en_pause');
  const total = snapshot.wallets.filter((w) => w.everyday).reduce((s, w) => s + w.balance, 0);
  const plan = monthPlan(snapshot);
  // Le même calcul que le plan du mois : un seul chiffre partout.
  const b = plan.budget;
  const [now, then] = b.segments;
  const when = (date: string) => (date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : formatDateCourt(date));

  return (
    <Screen title="Aujourd’hui" subtitle={formatDateFr(today)} help={<Aide k="calendrier" size={26} />}>
      <VisiteGuidee visible={tour} onClose={endTour} />
      {repo?.mode === 'demo' ? <Card tone="attention"><Status tone="attention">Exemple avec de faux chiffres : rien n’est enregistré.</Status></Card> : null}

      {b.shortage ? (
        <SummaryCard label="Il vous manque" amount={F(b.shortage.amount)} tone="rouge" icon="warning-outline" help={<Aide k="manque" />}>
          <Text style={{ fontSize: 15, color: C.texte }}>
            à partir du {formatDateCourt(b.shortage.date)}, pour tout payer d’ici la fin du mois{plan.debtTotal > 0 ? ` (dont ${F(plan.debtTotal)} de dettes)` : ''}. Évitez les dépenses qui peuvent attendre.
          </Text>
          {b.savingsPaused ? <Text style={{ fontSize: 15, color: C.secondaire }}>Vos versements d’épargne sont en pause ce mois-ci.</Text> : null}
        </SummaryCard>
      ) : (
        <SummaryCard label="Je peux dépenser aujourd’hui" amount={F(b.today)} help={<Aide k="peutDepenser" />}>
          <View style={{ height: 1, backgroundColor: 'rgba(30,24,59,0.12)' }} />
          <Text style={{ fontSize: 15, color: C.texte }}>
            {now && then ? `Chaque jour jusqu’au ${formatDateCourt(now.until)}, puis ${F(then.perDay)} par jour.` : 'Chaque jour jusqu’à la fin du mois.'}
          </Text>
          <Text style={{ fontSize: 15, color: C.secondaire }}>
            Factures{plan.debtTotal > 0 ? ', dettes' : ''}{b.reserves.nextMonth > 0 ? ' et début du mois prochain' : ''} déjà mis de côté. Vous avez {F(total)} en tout.
          </Text>
          {b.save > 0 ? (
            <Text style={{ fontSize: 15, color: C.mentheTexte, fontWeight: '700' }}>
              À mettre de côté : {F(b.save)} {b.saveOn === today ? 'aujourd’hui' : `le ${formatDateCourt(b.saveOn)}`}
            </Text>
          ) : null}
        </SummaryCard>
      )}

      {/* Calendrier du mois, comme Flo : toucher un jour pour voir ou planifier une entrée ou une sortie. */}
      <MonthCalendar plan={plan} today={today} selected={selected} onSelect={setSelected} />
      <CycleRing day={day} length={length} size={110} />

      <DayPanel day={selected} today={today} entries={plan.days[selected] ?? []} />
      <PlanCard plan={plan} />

      {pay.error ? <Status tone="risque">{pay.error}</Status> : null}
      {bills.map((e) => {
        const canPay = !!(e.item.recurring || e.item.loan);
        return (
          <View key={e.item.id} style={{ gap: 6 }}>
            <Row icon={itemIcon(e.item.label, e.item.category, e.item.kind, e.item.source)} title={e.item.label}
              sub={e.overdue ? 'En retard · à payer aujourd’hui' : when(e.date)} value={F(e.item.amount)}
              valueColor={e.overdue ? C.risque : undefined} />
            {canPay && (e.overdue || e.date <= addDays(today, 3)) ? (
              <Pressable disabled={pay.busy} accessibilityRole="button" accessibilityLabel={`J’ai payé ${e.item.label}`}
                onPress={() => confirmAction(`J’ai payé ${e.item.label.toLowerCase()} ?`, `${F(e.item.amount)} sortent de votre compte. Vous pourrez l’annuler depuis vos dernières opérations.`, 'Oui, payé',
                  () => { void pay.run((r, clientKey) => e.item.loan
                    ? r.recordLoanOperation({ clientKey, loanId: e.item.loan.loanId, installment: e.item.loan.n, amount: e.item.amount, walletId: e.item.walletId, date: e.date < today ? e.date : today })
                    : r.settleOccurrence({ clientKey, ruleId: e.item.recurring!.ruleId, original: e.item.recurring!.original, amount: e.item.amount, walletId: e.item.walletId, date: e.date < today ? e.date : today })); })}
                style={{ alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 6 }}>
                <Text style={{ color: C.violet, fontWeight: '700', fontSize: 15 }}>✓ J’ai payé {e.item.label.toLowerCase()}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <Button label="Tester un achat" icon="help-circle-outline" onPress={() => router.push('/tester-achat')} />
      <Button label="Ajouter" variant="secondaire" icon="add" onPress={() => router.push('/ajouter')} />

      {!(snapshot.recurring ?? []).some((r) => r.kind === 'rentree') && snapshot.wallets.length > 0 ? (
        <Row icon="briefcase-outline" title="Ajouter mon salaire" sub="Pour un calcul juste jusqu’à la paie"
          onPress={() => router.push({ pathname: '/ajouter', params: { type: 'mensuelle', sens: 'rentree' } })} />
      ) : null}

      {tip ? (
        <Row icon={tip.priority === 1 ? 'alert-circle-outline' : 'bulb-outline'} title={tip.title} sub="Le conseil de votre banquier"
          onPress={() => router.push('/analyste')} />
      ) : null}

      {(snapshot.operations ?? []).length ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.texte }}>Mes dernières opérations</Text>
            <Pressable onPress={() => router.push('/historique')} accessibilityRole="button" hitSlop={10}>
              <Text style={{ color: C.violet, fontWeight: '700' }}>Tout voir</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 14, color: C.secondaire }}>Touchez une ligne pour la modifier ou la supprimer.</Text>
          {[...(snapshot.operations ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 4)
            .map((o) => <OperationLine key={o.id} op={o} wallets={snapshot.wallets} />)}
        </Card>
      ) : null}

      {paused.map((i) => (
        <Row key={i.id} icon="pause-circle-outline" title={`Achat en pause · ${F(i.amount)}`} sub={`À revoir le ${formatDateCourt(i.date)}`}
          onPress={() => router.push({ pathname: '/achat-en-pause', params: { id: i.id } })} />
      ))}
    </Screen>
  );
}
