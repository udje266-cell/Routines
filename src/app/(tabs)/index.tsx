import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Hero, HeroText, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import {
  addDays, bankerSummary, categoryStatus, currentCycle, cycleDay, forecast, formatDateFr, formatFcfa, incomeStats, marginUntilNextIncome, spendingPace,
  upcomingEssentials, type Snapshot,
} from '@/domain';

/** Action du jour : la chose la plus utile à faire maintenant, sinon rien. */
function actionDuJour(snap: Snapshot) {
  const fc = forecast(snap);
  const late = fc.lateIncomes[0];
  if (late) return { tone: 'attention' as const, text: `${late.label} (${formatFcfa(late.amount)}) était attendu le ${formatDateFr(late.date)} : confirmez-le ou replanifiez-le.`, href: '/calendrier' as const };
  const overdue = fc.events.find((e) => e.overdue);
  if (overdue) return { tone: 'risque' as const, text: `${overdue.item.label} est en retard : ${formatFcfa(overdue.item.amount)} à couvrir aujourd’hui.`, href: '/calendrier' as const };
  const soon = fc.events.find((e) => e.item.kind !== 'rentree' && e.date > snap.today && e.date <= addDays(snap.today, 2));
  const paused = (snap.intents ?? []).find((i) => i.status === 'en_pause' && i.date <= snap.today);
  if (paused) return { tone: 'attention' as const, text: `Un achat de ${formatFcfa(paused.amount)} (${paused.category}) en pause est à revoir aujourd’hui.`, href: null };
  if (soon) return { tone: 'attention' as const, text: `Vérifiez ${soon.item.label} (${formatFcfa(soon.item.amount)}) prévu le ${formatDateFr(soon.date)}.`, href: '/calendrier' as const };
  return null;
}

export default function Aujourdhui() {
  const { snapshot, status, repo, signOut } = useFinance();
  const intent = useWrite('intention');

  if (!snapshot) {
    return (
      <Screen>
        <Title>Aujourd’hui</Title>
        <Label muted>{status === 'chargement' ? 'Chargement de votre budget…' : 'Budget indisponible.'}</Label>
      </Screen>
    );
  }

  const everyday = snapshot.wallets.filter((w) => w.everyday);
  const total = everyday.reduce((s, w) => s + w.balance, 0);
  const margin = marginUntilNextIncome(snapshot);
  const upcoming = forecast(snapshot).events.slice(0, 5);
  const cycle = currentCycle(snapshot);
  const { day, length } = cycleDay(snapshot.today, cycle);
  const stats = incomeStats(snapshot.operations ?? [], snapshot.today, cycle.start);
  const plan = Math.max(0, stats.mainMonthly - upcomingEssentials(snapshot));
  const pace = stats.cycleSpends.length && plan
    ? spendingPace({ today: snapshot.today, cycleStart: cycle.start, cycleEnd: cycle.end, plannedSpend: plan, spends: stats.cycleSpends, extraIncomes: stats.cycleSmallIncomes })
    : null;
  const pleasure = categoryStatus(snapshot.categories ?? [], snapshot.operations ?? [], cycle).filter((c) => c.pleasure);
  const paused = (snapshot.intents ?? []).filter((i) => i.status === 'en_pause');
  const action = actionDuJour(snapshot);

  return (
    <Screen>
      {repo?.mode === 'demo' ? (
        <Card tone="attention"><Status tone="attention">Découverte : données fictives, rien n’est enregistré.</Status></Card>
      ) : null}
      <Title>Aujourd’hui · {formatDateFr(snapshot.today)}</Title>
      <Label muted>Jour {day} sur {length} du cycle · fin le {formatDateFr(cycle.end)}</Label>

      {snapshot.wallets.length === 0 ? (
        <Card>
          <Label>Commencez par créer un portefeuille (Wave, Orange Money, espèces ou banque).</Label>
          <Button label="Créer un portefeuille" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'portefeuille' } })} />
        </Card>
      ) : (
        <>
          {action ? (
            <Card tone={action.tone}>
              <Label muted>Action du jour</Label>
              <Status tone={action.tone}>{action.text}</Status>
              {action.href ? <Button variant="secondaire" label="Voir" onPress={() => router.push(action.href!)} /> : null}
            </Card>
          ) : null}

          {(() => {
            const b = bankerSummary(snapshot);
            return (
              <Card tone={b.top?.priority === 1 ? 'risque' : b.top?.priority === 2 ? 'attention' : 'ok'}>
                <Label muted>Mon banquier · santé financière {b.health.score} / 100 ({b.health.grade})</Label>
                {b.top ? <Status tone={b.top.priority === 1 ? 'risque' : b.top.priority === 2 ? 'attention' : 'ok'}>{b.top.title}</Status>
                  : <Status tone="ok">Rien d’urgent : vos finances sont sous contrôle.</Status>}
                {b.top ? <Label>{b.top.detail}</Label> : null}
                <Button variant="secondaire" label={`Mon analyste (${b.count} conseil${b.count > 1 ? 's' : ''})`} onPress={() => router.push('/analyste')} />
              </Card>
            );
          })()}

          <Hero label={`Marge ${margin.nextIncome ? `jusqu’au ${formatDateFr(margin.nextIncome.date)}` : 'sur 60 jours'}`} value={formatFcfa(margin.amount)}>
            <HeroText>Disponible aujourd’hui : {formatFcfa(total)}</HeroText>
          </Hero>
          {margin.amount < 0 ? <Card tone="risque"><Status tone="risque">Vos échéances dépassent le disponible de {formatFcfa(-margin.amount)}.</Status></Card> : null}
          {margin.missingIncomeDate ? <Card tone="attention"><Status tone="attention">Aucune rentrée datée : ajoutez la date de votre prochain revenu.</Status></Card> : null}

          {pace && pace.status !== 'dans_le_plan' ? (
            <Card tone={pace.status === 'derapage' ? 'risque' : 'attention'}>
              <Status tone={pace.status === 'derapage' ? 'risque' : 'attention'}>
                À ce rythme, {formatFcfa(pace.projectedSpend)} dépensés sur le cycle ({formatFcfa(pace.overrun)} de trop).
              </Status>
              <Label>Budget du jour : {formatFcfa(pace.dailyAllowance)} · {pace.smallIncome.count} petites sommes reçues ({formatFcfa(pace.smallIncome.total)}).</Label>
            </Card>
          ) : null}

          {pleasure.map((c) => (
            <Card key={c.category} tone={c.status === 'depasse' ? 'risque' : c.status === 'presque' ? 'attention' : undefined}>
              <Status tone={c.status === 'depasse' ? 'risque' : c.status === 'presque' ? 'attention' : 'ok'}>
                {c.left >= 0 ? `Il vous reste ${formatFcfa(c.left)} pour ${c.category.toLowerCase()}.` : `${c.category} : plafond dépassé de ${formatFcfa(-c.left)}.`}
              </Status>
            </Card>
          ))}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="J’ai dépensé" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'depense' } })} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="J’ai reçu" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'revenu' } })} /></View>
          </View>
          <Button label="Tester un achat" hint="Vérifie si un achat compromet une échéance" onPress={() => router.push('/tester-achat')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Mon budget" onPress={() => router.push('/mon-budget')} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Historique" onPress={() => router.push('/historique')} /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Dépenses du mois" onPress={() => router.push('/depenses-mensuelles')} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Bilan du cycle" onPress={() => router.push('/bilan')} /></View>
          </View>

          {paused.length ? (
            <Card>
              <Label muted>Achats en pause</Label>
              {intent.error ? <Status tone="risque">{intent.error}</Status> : null}
              {paused.map((i) => (
                <View key={i.id} style={{ gap: 6 }}>
                  <Label>{formatFcfa(i.amount)} · {i.category} · à revoir le {formatDateFr(i.date)}</Label>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button variant="secondaire" label="Reprendre" hint="Relance la simulation avec ce montant"
                        onPress={() => router.push({ pathname: '/tester-achat', params: { intentId: i.id, amount: String(i.amount), category: i.category, walletId: i.walletId } })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button variant="secondaire" label="Abandonner" hint="Ce montant ne sera pas compté comme épargne" disabled={intent.busy}
                        onPress={() => intent.run((r) => r.updateIntent(i.id, 'abandonne'))} />
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Label muted>Portefeuilles</Label>
            {snapshot.wallets.map((w) => (
              <Label key={w.id}>{w.name}{w.everyday ? '' : ' (épargne)'} : {formatFcfa(w.balance)}</Label>
            ))}
          </Card>

          <Card>
            <Label muted>Prochaines échéances</Label>
            {upcoming.length === 0 ? <Label>Aucune échéance prévue.</Label> : null}
            {upcoming.map((e) => (
              <View key={e.item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Label>
                    {formatDateFr(e.date)} · {e.item.label} · {e.item.kind === 'rentree' ? '+' : '−'}{formatFcfa(e.item.amount)}
                    {e.overdue ? ' · ⚠ en retard, à couvrir aujourd’hui' : ''}
                  </Label>
                </View>
                {e.item.loan ? (
                  <Button variant="secondaire" label="Payé" disabled={intent.busy} hint={`${e.item.label} du ${formatDateFr(e.date)}`}
                    onPress={() => intent.run((r, clientKey) => r.recordLoanOperation({
                      clientKey, loanId: e.item.loan!.loanId, installment: e.item.loan!.n, amount: e.item.amount,
                      walletId: e.item.walletId, date: e.date < snapshot.today ? e.date : snapshot.today,
                    }))} />
                ) : e.item.recurring ? (
                  <Button variant="secondaire" label={e.item.kind === 'rentree' ? 'Reçu' : 'Payé'} disabled={intent.busy}
                    hint={`${e.item.label} du ${formatDateFr(e.date)}`}
                    onPress={() => intent.run((r, clientKey) => r.settleOccurrence({
                      clientKey, ruleId: e.item.recurring!.ruleId, original: e.item.recurring!.original, amount: e.item.amount,
                      walletId: e.item.walletId, date: e.date < snapshot.today ? e.date : snapshot.today,
                    }))} />
                ) : null}
              </View>
            ))}
          </Card>
        </>
      )}
      <Button variant="secondaire" label="Réglages (verrouillage, rappels, compte)" onPress={() => router.push('/reglages')} />
      <Button variant="secondaire" label={repo?.mode === 'demo' ? 'Quitter la découverte' : 'Se déconnecter'} onPress={signOut} />
    </Screen>
  );
}
