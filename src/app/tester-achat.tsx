import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { newClientKey } from '@/data/client-key';
import { useFinance } from '@/data/finance-context';
import { ConnectionRequiredError } from '@/data/repository';
import { addDays, formatDateFr, formatFcfa, parseFcfa, simulatePurchase, type SimulationResult } from '@/domain';

const BASE = ['Alimentation', 'Transport', 'Loisirs', 'Sorties', 'Habillement', 'Maison', 'Famille', 'Autre'];

export default function TesterAchat() {
  const { snapshot, write } = useFinance();
  // Reprise d'un achat en pause : montant, catégorie et portefeuille conservés.
  const params = useLocalSearchParams<{ intentId?: string; amount?: string; category?: string; walletId?: string }>();
  const today = snapshot?.today ?? '';
  const [amount, setAmount] = useState(params.amount ?? '');
  const [category, setCategory] = useState(params.category ?? 'Loisirs');
  const [walletId, setWalletId] = useState(params.walletId ?? snapshot?.wallets.find((w) => w.everyday)?.id ?? '');
  const [date, setDate] = useState(today);
  const [remind, setRemind] = useState<'oui' | 'non'>('non');
  // Une clé par intention d'écriture, conservée en cas de réessai après coupure.
  const [clientKey] = useState(() => newClientKey('achat'));
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const CATEGORIES = [...new Set([...BASE, ...(snapshot?.categories ?? []).map((c) => c.category), category])];
  const value = parseFcfa(amount);
  const result = useMemo<SimulationResult | { error: string } | null>(() => {
    if (!snapshot || !value || !walletId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    try {
      return simulatePurchase(snapshot, { amount: value, category, walletId, date });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [snapshot, value, category, walletId, date]);

  if (!snapshot) return <Screen><Label>Chargement…</Label></Screen>;
  if (snapshot.wallets.length === 0)
    return <Screen><Label>Créez d’abord un portefeuille.</Label><Button label="Créer un portefeuille" onPress={() => router.replace('/ajouter')} /></Screen>;

  async function act(kind: 'acheter' | 'pause' | 'reporter' | 'renoncer', newDate?: string) {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await write(async (repo) => {
        if (params.intentId) {
          // Achat repris depuis la pause : on met à jour la même intention.
          if (kind === 'acheter') await repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label: `Achat ${category}`, category });
          const status = kind === 'acheter' ? 'achete' : kind === 'pause' ? 'en_pause' : kind === 'reporter' ? 'replanifie' : 'abandonne';
          return repo.updateIntent(params.intentId, status, kind === 'pause' ? addDays(today, 1) : newDate);
        }
        return kind === 'acheter'
          ? repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label: `Achat ${category}`, category })
          : repo.saveIntent({
              clientKey, amount: value, category, walletId,
              date: newDate ?? date,
              status: kind === 'pause' ? 'en_pause' : kind === 'reporter' ? 'replanifie' : 'abandonne',
              remindOn: kind === 'pause' && remind === 'oui' ? addDays(today, 1) : undefined,
            });
      });
      setDone(
        kind === 'acheter' ? 'Achat enregistré.'
        : kind === 'pause' ? `Achat mis en pause jusqu’au ${formatDateFr(addDays(today, 1))}.`
        : kind === 'reporter' ? `Achat reporté au ${formatDateFr(newDate!)}.`
        : 'Achat abandonné. Ce montant n’est pas compté comme épargne.',
      );
    } catch (e) {
      setError(e instanceof ConnectionRequiredError
        ? 'Connexion requise. Rien n’est perdu : réessayez, l’opération ne sera pas créée deux fois.'
        : 'Enregistrement refusé.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Card tone="ok"><Status tone="ok">{done}</Status></Card>
        <Button label="Revenir à Aujourd’hui" onPress={() => router.back()} />
      </Screen>
    );
  }

  // Un achat se paie depuis un portefeuille du quotidien, jamais depuis une poche d'épargne.
  const wallets = snapshot.wallets.filter((w) => w.everyday);
  return (
    <Screen>
      <Field label="Montant (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="8 000"
        error={amount && !value ? 'Montant en francs entiers.' : null} />
      <Choice label="Catégorie" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: `${w.name} (${formatFcfa(w.balance)})` }))} />
      <Choice label="Date" value={date === today ? 'auj' : date === addDays(today, 1) ? 'dem' : 'autre'}
        onChange={(v) => v !== 'autre' && setDate(v === 'auj' ? today : addDays(today, 1))}
        options={[{ value: 'auj', label: 'Aujourd’hui' }, { value: 'dem', label: 'Demain' }, { value: 'autre', label: 'Autre date' }]} />
      <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />

      {result && 'error' in result ? <Status tone="risque">{result.error}</Status> : null}
      {result && !('error' in result) ? <Verdict r={result} /> : null}

      {result && !('error' in result) ? (
        <Card>
          <Label muted>Simulation seule : rien n’est enregistré tant que vous ne choisissez pas.</Label>
          {error ? <Status tone="risque">{error}</Status> : null}
          <Button label={result.verdict === 'ok' ? 'Enregistrer l’achat' : 'Acheter quand même'} disabled={busy} onPress={() => act('acheter')}
            variant={result.verdict === 'ok' ? 'primaire' : 'secondaire'} />
          {result.alternativeDate ? (
            <Button label={`Reporter au ${formatDateFr(result.alternativeDate)}`} disabled={busy} onPress={() => act('reporter', result.alternativeDate!)} />
          ) : null}
          <Choice label="Rappel demain" value={remind} onChange={setRemind} options={[{ value: 'non', label: 'Sans rappel' }, { value: 'oui', label: 'Me le rappeler' }]} />
          <Button label="Mettre en pause jusqu’à demain" variant="secondaire" disabled={busy} onPress={() => act('pause')} />
          <Button label="Renoncer" variant="secondaire" disabled={busy} onPress={() => act('renoncer')} />
        </Card>
      ) : null}
    </Screen>
  );
}

function Verdict({ r }: { r: SimulationResult }) {
  const sf = r.shortfall;
  return (
    <Card tone={r.verdict === 'ok' ? 'ok' : r.verdict === 'risque' ? 'risque' : 'attention'}>
      {sf ? (
        <>
          <Title>{formatFcfa(sf.caused)} manquants le {formatDateFr(sf.date)}</Title>
          <Status tone="risque">
            {sf.item.source === 'achat' ? 'Le solde ne suffit pas pour cet achat.' : `Compromet : ${sf.item.label} (${formatFcfa(sf.item.amount)})`}
            {sf.scope === 'total' ? ' — sur le total disponible' : ''}
          </Status>
          {sf.preexisting > 0 ? <Label>Déficit déjà prévu sans cet achat : {formatFcfa(sf.preexisting)}. L’achat l’aggrave de {formatFcfa(sf.caused)}.</Label> : null}
          <Label>{r.alternativeDate ? `Première date compatible : ${formatDateFr(r.alternativeDate)}.` : 'Aucune date ne convient dans les 60 jours.'}</Label>
        </>
      ) : r.dependsOn ? (
        <>
          <Status tone="attention">Possible seulement si la rentrée arrive.</Status>
          <Label>Sans {r.dependsOn.incomes.map((i) => `${i.label} (${formatDateFr(i.date)})`).join(', ')}, il manquerait {formatFcfa(r.dependsOn.shortfall.caused)} le {formatDateFr(r.dependsOn.shortfall.date)}.</Label>
        </>
      ) : (
        <Status tone="ok">Aucune échéance compromise sur 60 jours.</Status>
      )}
      {r.pleasure && r.pleasure.leftAfter >= 0 ? (
        <Label>Budget plaisir : il vous restera {formatFcfa(r.pleasure.leftAfter)} pour {r.pleasure.category.toLowerCase()}.</Label>
      ) : null}
      {r.categoryOverrun ? (
        <Status tone="attention">Dépasse le plafond {r.categoryOverrun.category} de {formatFcfa(r.categoryOverrun.over)} : montant à réaffecter depuis une autre enveloppe.</Status>
      ) : null}
      {r.undatedDebts.length ? <Label>Dettes à payer sans date : {r.undatedDebts.map((d) => `${d.person} ${formatFcfa(d.remaining)}`).join(', ')}.</Label> : null}
    </Card>
  );
}
