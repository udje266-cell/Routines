import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { AmountField, DateField, TileChoice } from '@/components/inputs';
import { Button, C, Card, Label, Screen, Status, SummaryCard } from '@/components/ui';
import { Text, View } from 'react-native';
import { newClientKey } from '@/data/client-key';
import { useFinance } from '@/data/finance-context';
import { ConnectionRequiredError } from '@/data/repository';
import { addDays, formatDateCourt, formatDateFr, formatFcfa, simulatePurchase, type SimulationResult } from '@/domain';
import { CATEGORY_TILES, categoryLabel, walletIcon } from '@/lib/categories';


export default function TesterAchat() {
  const { snapshot, write } = useFinance();
  // Reprise d'un achat en pause : montant, catégorie et portefeuille conservés.
  const params = useLocalSearchParams<{ intentId?: string; amount?: string; category?: string; walletId?: string }>();
  const today = snapshot?.today ?? '';
  const [amount, setAmount] = useState<number | null>(params.amount ? Number(params.amount) : null);
  const [category, setCategory] = useState(params.category ?? 'Sorties');
  const [walletId, setWalletId] = useState(params.walletId ?? snapshot?.wallets.find((w) => w.everyday)?.id ?? '');
  const [date, setDate] = useState(today);
  // Une clé par intention d'écriture, conservée en cas de réessai après coupure.
  const [clientKey] = useState(() => newClientKey('achat'));
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const value = amount;
  const result = useMemo<SimulationResult | { error: string } | null>(() => {
    if (!snapshot || !value || !walletId) return null;
    try {
      return simulatePurchase(snapshot, { amount: value, category, walletId, date });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [snapshot, value, category, walletId, date]);

  if (!snapshot) return <Screen><Label>Chargement…</Label></Screen>;
  if (snapshot.wallets.length === 0)
    return <Screen><Label>Ajoutez d’abord un compte (Wave, Orange Money, espèces…).</Label><Button label="Ajouter un compte" onPress={() => router.replace({ pathname: '/ajouter', params: { type: 'portefeuille' } })} /></Screen>;

  async function act(kind: 'acheter' | 'pause' | 'reporter' | 'renoncer', newDate?: string) {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await write(async (repo) => {
        if (params.intentId) {
          // Achat repris depuis la pause : on met à jour la même intention.
          if (kind === 'acheter') await repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label: categoryLabel(category), category });
          const status = kind === 'acheter' ? 'achete' : kind === 'pause' ? 'en_pause' : kind === 'reporter' ? 'replanifie' : 'abandonne';
          return repo.updateIntent(params.intentId, status, kind === 'pause' ? addDays(today, 1) : newDate);
        }
        return kind === 'acheter'
          ? repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label: categoryLabel(category), category })
          : repo.saveIntent({
              clientKey, amount: value, category, walletId,
              date: newDate ?? date,
              status: kind === 'pause' ? 'en_pause' : kind === 'reporter' ? 'replanifie' : 'abandonne',
              remindOn: kind === 'pause' ? addDays(today, 1) : undefined,
            });
      });
      setDone(
        kind === 'acheter' ? 'C’est noté : la dépense est enregistrée.'
        : kind === 'pause' ? `C’est noté : on en reparle demain (${formatDateFr(addDays(today, 1))}). Vous le retrouverez sur l’accueil.`
        : kind === 'reporter' ? `C’est noté : achat prévu le ${formatDateFr(newDate!)}.`
        : 'Bonne décision. Pour que cet argent compte vraiment, mettez-le de côté dans l’onglet Épargne.',
      );
    } catch (e) {
      setError(e instanceof ConnectionRequiredError
        ? 'Connexion requise. Rien n’est perdu : réessayez, l’opération ne sera pas créée deux fois.'
        : 'L’enregistrement n’a pas abouti. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Card tone="ok"><Status tone="ok">{done}</Status></Card>
        <Button label="Revenir à l’accueil" onPress={() => router.back()} />
      </Screen>
    );
  }

  // Un achat se paie depuis un portefeuille du quotidien, jamais depuis une poche d'épargne.
  const wallets = snapshot.wallets.filter((w) => w.everyday);
  return (
    <Screen>
      <AmountField label="Combien coûte ce que vous voulez acheter ?" value={amount} onChange={setAmount} autoFocus />
      <TileChoice label="Catégorie" rowIcon="pricetag-outline" value={category} onChange={setCategory} options={CATEGORY_TILES} />
      <TileChoice label="Payé avec" rowIcon="wallet-outline" value={walletId} onChange={setWalletId}
        options={wallets.map((w) => ({ value: w.id, label: w.name, sub: formatFcfa(w.balance), icon: walletIcon(w.kind) }))} />
      <DateField label="Date" value={date} onChange={setDate} today={today} min={today} />

      {result && 'error' in result ? <Status tone="risque">{result.error}</Status> : null}
      {result && !('error' in result) ? <Verdict r={result} /> : null}

      {result && !('error' in result) ? (
        <>
          {error ? <Status tone="risque">{error}</Status> : null}
          {result.verdict === 'ok' ? (
            <Button label="Je l’achète" disabled={busy} onPress={() => act('acheter')} />
          ) : (
            <Button label="Mettre en pause" disabled={busy} onPress={() => act('pause')} />
          )}
          {result.alternativeDate ? (
            <Button variant="lien" label={`Changer la date : le ${formatDateCourt(result.alternativeDate)}`} disabled={busy}
              onPress={() => act('reporter', result.alternativeDate!)} />
          ) : null}
          {result.verdict === 'ok' ? (
            <Button variant="lien" label="J’y réfléchis jusqu’à demain" disabled={busy} onPress={() => act('pause')} />
          ) : (
            <Button variant="lien" label="Je l’achète quand même" disabled={busy} onPress={() => act('acheter')} />
          )}
          <Button variant="lien" label="Je n’achète pas" disabled={busy} onPress={() => act('renoncer')} />
          <Label muted>Rien n’est enregistré tant que vous ne choisissez pas.</Label>
        </>
      ) : null}
    </Screen>
  );
}

function Verdict({ r }: { r: SimulationResult }) {
  const sf = r.shortfall;
  const extras = (
    <>
      {r.pleasure && r.pleasure.leftAfter >= 0 ? (
        <Label>Il vous restera {formatFcfa(r.pleasure.leftAfter)} pour vos {categoryLabel(r.pleasure.category).toLowerCase()} ce mois-ci.</Label>
      ) : null}
      {r.categoryOverrun ? (
        <Status tone="attention">Vous dépasseriez de {formatFcfa(r.categoryOverrun.over)} la limite fixée pour « {categoryLabel(r.categoryOverrun.category)} ».</Status>
      ) : null}
      {r.undatedDebts.length ? <Label>N’oubliez pas ce que vous devez encore : {r.undatedDebts.map((d) => `${d.person} (${formatFcfa(d.remaining)})`).join(', ')}.</Label> : null}
    </>
  );
  if (sf)
    return (
      <SummaryCard label="À reporter" amount={`${formatFcfa(sf.caused)} CFA`} tone="ambre" icon="warning-outline">
        <View style={{ height: 1, backgroundColor: 'rgba(30,24,59,0.15)' }} />
        <Text style={{ fontSize: 17, color: C.texte }}>
          {sf.item.source === 'achat'
            ? 'Il manque cet argent sur ce compte pour payer l’achat.'
            : `Manquants le ${formatDateCourt(sf.date)} pour payer « ${sf.item.label} ».`}
        </Text>
        {sf.preexisting > 0 ? <Text style={{ fontSize: 15, color: C.secondaire }}>Même sans cet achat, il manquait déjà {formatFcfa(sf.preexisting)} ce jour-là.</Text> : null}
        <Text style={{ fontSize: 15, color: C.secondaire }}>
          {r.alternativeDate ? `Le bon moment : à partir du ${formatDateCourt(r.alternativeDate)}.` : 'Aucun bon moment dans les 2 prochains mois.'}
        </Text>
        {extras}
      </SummaryCard>
    );
  if (r.dependsOn)
    return (
      <SummaryCard label="Possible, mais risqué" amount="Attendez un peu" tone="ambre" icon="alert-circle-outline">
        <Text style={{ fontSize: 16, color: C.texte }}>
          Ça passe seulement si {r.dependsOn.incomes.map((i) => `« ${i.label} »`).join(', ')} arrive à temps. Sinon, il vous manquera {formatFcfa(r.dependsOn.shortfall.caused)} le {formatDateCourt(r.dependsOn.shortfall.date)}.
        </Text>
        {extras}
      </SummaryCard>
    );
  return (
    <SummaryCard label="Bonne nouvelle" amount="Vous pouvez" tone="menthe" icon="checkmark-circle-outline">
      <Text style={{ fontSize: 16, color: C.texte }}>Toutes vos factures des 2 prochains mois restent payées.</Text>
      {extras}
    </SummaryCard>
  );
}
