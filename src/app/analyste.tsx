import { Aide } from '@/components/aide';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, C, Card, Choice, Hero, HeroText, Label, Screen, Status, Title } from '@/components/ui';
import { AmountField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import {
  advise, categoryTrends, financialHealth, formatDateFr, formatFcfa, futureValue, monthlyHistory, netWorth, parseFcfa,
  PLACEMENTS, placementFor, ratios, unusualSpends, type Advice,
} from '@/domain';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const tone = (p: Advice['priority']): 'risque' | 'attention' | 'ok' => (p === 1 ? 'risque' : p === 2 ? 'attention' : 'ok');
const PRIORITE = { 1: 'Urgent', 2: 'Important', 3: 'Opportunité' } as const;

/** Barre horizontale proportionnelle, décorative (la valeur est toujours écrite à côté). */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(2, Math.round((Math.max(0, value) / max) * 100)) : 0;
  return (
    <View importantForAccessibility="no" style={{ height: 8, borderRadius: 4, backgroundColor: C.lavandeClair }}>
      <View style={{ width: `${w}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export default function Analyste() {
  const { snapshot } = useFinance();
  if (!snapshot) return <Screen><Title>Mon analyste</Title></Screen>;
  const health = financialHealth(snapshot);
  const nw = netWorth(snapshot);
  const r = ratios(snapshot);
  const list = advise(snapshot);
  const pockets = snapshot.wallets.filter((w) => !w.everyday).map((w) => w.id);
  const hist = monthlyHistory(snapshot.operations ?? [], pockets, snapshot.today, 3);
  const histMax = Math.max(...hist.map((m) => Math.max(m.income, m.spending)), 1);
  const trends = categoryTrends(snapshot.operations ?? [], snapshot.today).filter((t) => t.current > 0);
  const trendMax = Math.max(...trends.map((t) => t.current), 1);
  const unusual = unusualSpends(snapshot.operations ?? [], snapshot.today);

  return (
    <Screen>
      <Title>Mon analyste</Title>
      <Hero label="Santé financière" value={`${health.score} / 100`} help={<Aide k="sante" />}>
        <HeroText strong>{health.grade}</HeroText>
        <HeroText>{list.filter((a) => a.priority === 1).length} point(s) urgent(s) · {list.length} recommandation(s)</HeroText>
      </Hero>

      <Card>
        <Label muted>Les 5 piliers (20 points chacun)</Label>
        {health.pillars.map((p) => (
          <View key={p.key} style={{ gap: 2, paddingVertical: 4 }}>
            <Status tone={p.status}>{p.label} : {p.score} / 20</Status>
            <Label muted>{p.detail}</Label>
          </View>
        ))}
      </Card>

      <Card>
        <Label muted>Recommandations, par ordre de priorité</Label>
        {list.length === 0 ? <Status tone="ok">Rien d’urgent : continuez ainsi.</Status> : null}
        {list.map((a) => (
          <View key={a.id} style={{ gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.bord }}>
            <Status tone={tone(a.priority)}>{PRIORITE[a.priority]} · {a.title}</Status>
            <Label>{a.detail}</Label>
            {a.impact ? <Label muted>Impact : {formatFcfa(a.impact.amount)} {a.impact.label}</Label> : null}
            {a.action && a.action.href !== '/analyste' ? (
              <Button variant="secondaire" label={a.action.label} onPress={() => router.push(a.action!.href)} />
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <Label muted>Patrimoine net</Label>
        <Title>{formatFcfa(nw.net)}</Title>
        <Label>Ce que vous avez : {formatFcfa(nw.assets)} (quotidien {formatFcfa(nw.liquid)}, épargne {formatFcfa(nw.savings)}, on vous doit {formatFcfa(nw.receivables)})</Label>
        <Label>Ce que vous devez : {formatFcfa(nw.liabilities)} (crédits {formatFcfa(nw.loans)}, proches {formatFcfa(nw.personalDebts)})</Label>
      </Card>

      <Card>
        <Label muted>Indicateurs</Label>
        <Label>Revenu moyen : {formatFcfa(r.income)} / mois (salaire {formatFcfa(r.mainIncome)}, petites sommes {formatFcfa(r.smallIncome)})</Label>
        <Label>Charges fixes : {formatFcfa(r.fixedCharges)} / mois, dont crédits {formatFcfa(r.loanPayments)}</Label>
        <Label>Taux d’épargne : {Math.round(r.savingsRate * 100)} % · endettement : {Number.isFinite(r.debtService) ? Math.round(r.debtService * 100) : '—'} % · sécurité : {Number.isFinite(r.emergencyMonths) ? r.emergencyMonths.toFixed(1).replace('.', ',') : '—'} mois</Label>
      </Card>

      <Card>
        <Label muted>Les 3 derniers mois</Label>
        {hist.map((m) => (
          <View key={m.month} style={{ gap: 3, paddingVertical: 4 }}>
            <Label>{MOIS[Number(m.month.slice(5)) - 1]} {m.month.slice(0, 4)} : rentrées {formatFcfa(m.income)} · dépenses {formatFcfa(m.spending)} · épargne {formatFcfa(m.saved)}</Label>
            <Bar value={m.income} max={histMax} color={C.menthe} />
            <Bar value={m.spending} max={histMax} color={m.spending > m.income ? C.risque : C.marine} />
          </View>
        ))}
        <Label muted>Vert : argent reçu · foncé : dépenses (rouge si elles dépassent ce qui est reçu).</Label>
      </Card>

      <Card>
        <Label muted>Où part l’argent ce mois-ci</Label>
        {trends.length === 0 ? <Label>Aucune dépense ce mois-ci.</Label> : null}
        {trends.map((t) => (
          <View key={t.category} style={{ gap: 3, paddingVertical: 3 }}>
            <Label>
              {t.category} : {formatFcfa(t.current)} ({Math.round(t.share * 100)} %)
              {t.change !== null ? ` · ${t.change >= 0 ? '+' : ''}${Math.round(t.change * 100)} % par rapport à la même date` : ''}
              {t.smallCount >= 5 ? ` · ${t.smallCount} petites dépenses` : ''}
            </Label>
            <Bar value={t.current} max={trendMax} color={t.change !== null && t.change > 0.3 ? C.attention : C.marine} />
          </View>
        ))}
        {unusual.length ? (
          <Status tone="attention">Dépenses inhabituelles : {unusual.map((o) => `${o.label} ${formatFcfa(o.amount)} (${formatDateFr(o.date)})`).join(', ')}</Status>
        ) : null}
      </Card>

      <Placements emergencyComplete={r.emergencyMonths >= 3} />
    </Screen>
  );
}

function Placements({ emergencyComplete }: { emergencyComplete: boolean }) {
  const [initial, setInitial] = useState('100 000');
  const [monthly, setMonthly] = useState('20 000');
  const [months, setMonths] = useState<'12' | '36' | '60'>('36');
  const m = Number(months);
  const i = parseFcfa(initial) ?? 0;
  const v = parseFcfa(monthly) ?? 0;
  const advised = placementFor(m, emergencyComplete);
  const invested = i + v * m;

  return (
    <Card>
      <Label muted>Faire fructifier l’épargne</Label>
      {!emergencyComplete ? (
        <Status tone="attention">Priorité : un fonds d’urgence de 3 mois de charges sur un livret disponible à tout moment, avant tout placement bloqué.</Status>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><AmountField label="Capital de départ (F)" value={parseFcfa(initial)} onChange={(v) => setInitial(v === null ? '' : String(v))} /></View>
        <View style={{ flex: 1 }}><AmountField label="Versement / mois (F)" value={parseFcfa(monthly)} onChange={(v) => setMonthly(v === null ? '' : String(v))} /></View>
      </View>
      <Choice label="Horizon" value={months} onChange={setMonths} options={[{ value: '12', label: '1 an' }, { value: '36', label: '3 ans' }, { value: '60', label: '5 ans' }]} />
      <Label>Vous versez {formatFcfa(invested)} au total.</Label>
      {PLACEMENTS.map((p) => {
        const fv = futureValue(i, v, p.rate, m);
        const ok = m >= p.minMonths;
        return (
          <View key={p.id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.bord }}>
            <Status tone={p.id === advised.id ? 'ok' : 'attention'}>
              {p.id === advised.id ? 'Conseillé · ' : ''}{p.name}
            </Status>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.texte }}>
              {ok ? `${formatFcfa(fv)} (+${formatFcfa(fv - invested)})` : `Durée minimale : ${p.minMonths} mois`}
            </Text>
            <Label muted>Taux retenu {(p.rate * 100).toFixed(1).replace('.', ',')} % ({p.range}). {p.liquidity} Risque : {p.risk}</Label>
            <Label muted>Source : {p.source}</Label>
          </View>
        );
      })}
      <Label muted>Repères indicatifs avant impôts et frais : comparez les offres de votre banque ou d’une SGI agréée avant de placer.</Label>
    </Card>
  );
}
