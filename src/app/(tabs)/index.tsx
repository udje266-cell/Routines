import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { OperationLine } from '@/components/operation-line';
import { CycleRing } from '@/components/ring';
import { Button, C, Card, Label, Row, Screen, Status, SummaryCard } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, advise, currentCycle, cycleDay, formatDateFr, formatFcfa, forecast, safeToSpend } from '@/domain';
import { itemIcon } from '@/lib/categories';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const F = (n: number) => `${formatFcfa(n).replace(/ F$/, '')} F CFA`;

export default function Aujourdhui() {
  const { snapshot, status, repo } = useFinance();
  const pay = useWrite('paiement-accueil');
  const today = snapshot?.today ?? '2026-01-01';
  const [, m, d] = today.split('-').map(Number);

  if (!snapshot) {
    return (
      <Screen title="Aujourd’hui" subtitle={`${d} ${MOIS[m - 1]}`}>
        <Label muted>{status === 'chargement' ? 'Chargement de votre budget…' : 'Budget indisponible pour le moment.'}</Label>
      </Screen>
    );
  }

  const cycle = currentCycle(snapshot);
  const { day, length } = cycleDay(today, cycle);
  const sts = safeToSpend(snapshot, cycle.end);
  const bills = forecast(snapshot).events.filter((e) => e.item.kind !== 'rentree').slice(0, 3);
  const tip = advise(snapshot)[0] ?? null;
  const paused = (snapshot.intents ?? []).filter((i) => i.status === 'en_pause');
  const total = snapshot.wallets.filter((w) => w.everyday).reduce((s, w) => s + w.balance, 0);
  const short = sts.afterBills < 0;
  const when = (date: string) => (date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : formatDateFr(date).replace(/ \d{4}$/, ''));

  return (
    <Screen title="Aujourd’hui" subtitle={`${d} ${MOIS[m - 1]}`}>
      {repo?.mode === 'demo' ? <Card tone="attention"><Status tone="attention">Exemple avec de faux chiffres : rien n’est enregistré.</Status></Card> : null}

      <CycleRing day={day} length={length} />

      {short ? (
        <SummaryCard label="Il vous manque" amount={F(-sts.afterBills)} tone="rouge" icon="warning-outline">
          <Text style={{ fontSize: 15, color: C.texte }}>
            pour payer vos factures d’ici le {formatDateFr(sts.until).replace(/ \d{4}$/, '').replace(/\.$/, '')}. Évitez les dépenses qui peuvent attendre.
          </Text>
        </SummaryCard>
      ) : (
        <SummaryCard label="Je peux dépenser aujourd’hui" amount={F(sts.perDay)}>
          <View style={{ height: 1, backgroundColor: 'rgba(30,24,59,0.12)' }} />
          <Text style={{ fontSize: 15, color: C.texte }}>
            Factures déjà mises de côté · {sts.nextIncome ? `jusqu’à la paie du ${formatDateFr(sts.nextIncome.date).replace(/ \d{4}$/, '')}` : 'jusqu’à la fin du mois'}
          </Text>
          <Text style={{ fontSize: 15, color: C.secondaire }}>Vous avez {F(total)} en tout.</Text>
        </SummaryCard>
      )}

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
                onPress={() => pay.run((r, clientKey) => e.item.loan
                  ? r.recordLoanOperation({ clientKey, loanId: e.item.loan.loanId, installment: e.item.loan.n, amount: e.item.amount, walletId: e.item.walletId, date: e.date < today ? e.date : today })
                  : r.settleOccurrence({ clientKey, ruleId: e.item.recurring!.ruleId, original: e.item.recurring!.original, amount: e.item.amount, walletId: e.item.walletId, date: e.date < today ? e.date : today }))}
                style={{ alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 6 }}>
                <Text style={{ color: C.violet, fontWeight: '700', fontSize: 15 }}>✓ J’ai payé {e.item.label.toLowerCase()}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <Button label="Tester un achat" icon="help-circle-outline" onPress={() => router.push('/tester-achat')} />
      <Button label="Ajouter" variant="secondaire" icon="add" onPress={() => router.push('/ajouter')} />

      {!sts.nextIncome && snapshot.wallets.length > 0 ? (
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
        <Row key={i.id} icon="pause-circle-outline" title={`Achat en pause · ${F(i.amount)}`} sub={`À revoir le ${formatDateFr(i.date).replace(/ \d{4}$/, '')}`}
          onPress={() => router.push({ pathname: '/achat-en-pause', params: { id: i.id } })} />
      ))}
    </Screen>
  );
}
