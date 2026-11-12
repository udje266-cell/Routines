import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import {
  endOfMonth, forecast, formatDateFr, formatFcfa, incomeStats, marginUntilNextIncome, spendingPace, startOfMonth, upcomingEssentials,
} from '@/domain';

export default function Aujourdhui() {
  const { snapshot, status, repo, signOut } = useFinance();

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
  // Action du jour : rythme des dépenses du mois et petites sommes reçues.
  const cycleStart = startOfMonth(snapshot.today);
  const cycleEnd = endOfMonth(snapshot.today);
  const stats = incomeStats(snapshot.operations ?? [], snapshot.today, cycleStart);
  const plan = Math.max(0, stats.mainMonthly - upcomingEssentials(snapshot));
  const pace = stats.cycleSpends.length && plan
    ? spendingPace({ today: snapshot.today, cycleStart, cycleEnd, plannedSpend: plan, spends: stats.cycleSpends, extraIncomes: stats.cycleSmallIncomes })
    : null;

  return (
    <Screen>
      {repo?.mode === 'demo' ? (
        <Card tone="attention"><Status tone="attention">Découverte : données fictives, rien n’est enregistré.</Status></Card>
      ) : null}
      <Title>Aujourd’hui · {formatDateFr(snapshot.today)}</Title>

      {snapshot.wallets.length === 0 ? (
        <Card>
          <Label>Commencez par créer un portefeuille (Wave, Orange Money, espèces ou banque).</Label>
          <Button label="Créer un portefeuille" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'portefeuille' } })} />
        </Card>
      ) : (
        <>
          <Card tone={margin.amount < 0 ? 'risque' : 'ok'}>
            <Label muted>Marge {margin.nextIncome ? `jusqu’au ${formatDateFr(margin.nextIncome.date)}` : 'sur 60 jours'}</Label>
            <Title>{formatFcfa(margin.amount)}</Title>
            {margin.amount < 0 ? <Status tone="risque">Vos échéances dépassent le disponible.</Status> : null}
            {margin.missingIncomeDate ? <Status tone="attention">Aucune rentrée datée : ajoutez la date de votre prochain revenu.</Status> : null}
            <Label muted>Disponible aujourd’hui : {formatFcfa(total)}</Label>
          </Card>

          {pace && pace.status !== 'dans_le_plan' ? (
            <Card tone={pace.status === 'derapage' ? 'risque' : 'attention'}>
              <Status tone={pace.status === 'derapage' ? 'risque' : 'attention'}>
                À ce rythme, {formatFcfa(pace.projectedSpend)} dépensés ce mois ({formatFcfa(pace.overrun)} de trop).
              </Status>
              <Label>Budget du jour : {formatFcfa(pace.dailyAllowance)} · {pace.smallIncome.count} petites sommes reçues ({formatFcfa(pace.smallIncome.total)}).</Label>
            </Card>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="J’ai dépensé" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'depense' } })} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="J’ai reçu" onPress={() => router.push({ pathname: '/ajouter', params: { type: 'revenu' } })} /></View>
          </View>
          <Button label="Tester un achat" hint="Vérifie si un achat compromet une échéance" onPress={() => router.push('/tester-achat')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Ajouter" onPress={() => router.push('/ajouter')} /></View>
            <View style={{ flex: 1 }}><Button variant="secondaire" label="Mon budget" onPress={() => router.push('/mon-budget')} /></View>
          </View>

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
              <Label key={e.item.id}>
                {formatDateFr(e.date)} · {e.item.label} · {e.item.kind === 'rentree' ? '+' : '−'}{formatFcfa(e.item.amount)}
                {e.overdue ? ' · ⚠ en retard, à couvrir aujourd’hui' : ''}
              </Label>
            ))}
          </Card>
        </>
      )}
      <Button variant="secondaire" label={repo?.mode === 'demo' ? 'Quitter la découverte' : 'Se déconnecter'} onPress={signOut} />
    </Screen>
  );
}
