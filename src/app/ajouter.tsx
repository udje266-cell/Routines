import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AmountField, DateField, DayOfMonthField, TileChoice } from '@/components/inputs';
import { Button, C, Choice, Field, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, type WalletKind } from '@/domain';
import { CATEGORY_TILES, WALLET_TILES, walletIcon } from '@/lib/categories';

type Type = 'depense' | 'revenu' | 'transfert' | 'mensuelle' | 'sortie' | 'rentree' | 'portefeuille';

/** Ce que l'on veut noter, en mots de tous les jours. */
const MAIN: { value: Type; label: string; icon: 'remove-circle-outline' | 'add-circle-outline' | 'swap-horizontal-outline' }[] = [
  { value: 'depense', label: 'J’ai dépensé', icon: 'remove-circle-outline' },
  { value: 'revenu', label: 'J’ai reçu', icon: 'add-circle-outline' },
  { value: 'transfert', label: 'J’ai déplacé', icon: 'swap-horizontal-outline' },
];
const MORE: { value: Type; label: string; icon: 'repeat-outline' | 'time-outline' | 'hourglass-outline' | 'wallet-outline' }[] = [
  { value: 'mensuelle', label: 'Facture de chaque mois', icon: 'repeat-outline' },
  { value: 'sortie', label: 'À payer plus tard', icon: 'time-outline' },
  { value: 'rentree', label: 'Argent attendu', icon: 'hourglass-outline' },
  { value: 'portefeuille', label: 'Nouveau compte', icon: 'wallet-outline' },
];
const TITLE: Record<Type, string> = {
  depense: 'Combien avez-vous dépensé ?', revenu: 'Combien avez-vous reçu ?', transfert: 'Combien avez-vous déplacé ?',
  mensuelle: 'Montant chaque mois', sortie: 'Montant à payer', rentree: 'Montant attendu', portefeuille: 'Combien y a-t-il dessus aujourd’hui ?',
};

export default function Ajouter() {
  const params = useLocalSearchParams<{ type?: Type; sens?: 'sortie' | 'rentree' }>();
  const { snapshot } = useFinance();
  const today = snapshot?.today ?? '2026-01-01';
  const wallets = snapshot?.wallets ?? [];
  const everyday = wallets.filter((w) => w.everyday);
  const [type, setType] = useState<Type>(params.type ?? (wallets.length ? 'depense' : 'portefeuille'));
  const [showMore, setShowMore] = useState(MORE.some((m) => m.value === type));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('wave');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(['depense', 'revenu', 'transfert'].includes(type) ? today : addDays(today, 1));
  const [walletId, setWalletId] = useState(everyday[0]?.id ?? '');
  const [category, setCategory] = useState(type === 'mensuelle' ? 'Logement' : 'Alimentation');
  const [incomeType, setIncomeType] = useState<'principal' | 'petite'>('petite');
  const [sure, setSure] = useState<'attendue' | 'incertaine'>('attendue');
  const [day, setDay] = useState(Math.min(28, Number(today.slice(8)) || 1));
  const [toWalletId, setToWalletId] = useState(wallets.find((x) => x.id !== everyday[0]?.id)?.id ?? '');
  const [fee, setFee] = useState<number | null>(null);
  const [monthlyKind, setMonthlyKind] = useState<'sortie' | 'rentree'>(params.sens ?? 'sortie');
  const { run, busy, error, setError } = useWrite('saisie');

  function changeType(t: Type) {
    setType(t);
    setError(null);
    setCategory(t === 'mensuelle' ? 'Logement' : 'Alimentation');
    setDate(['depense', 'revenu', 'transfert'].includes(t) ? today : addDays(today, 1));
  }

  async function save() {
    const real = type === 'depense' || type === 'revenu' || type === 'transfert';
    if (amount === null || (type !== 'portefeuille' && amount <= 0)) return setError('Indiquez le montant.');
    if (type === 'transfert' && (!toWalletId || toWalletId === walletId)) return setError('Choisissez deux comptes différents.');
    if (type !== 'portefeuille' && !walletId) return setError('Choisissez le compte.');
    if (real && date > today) return setError('Cette date est dans le futur : utilisez « À payer plus tard » ou « Argent attendu ».');
    if (['portefeuille', 'sortie', 'rentree', 'mensuelle'].includes(type) && !name.trim()) return setError('Donnez-lui un nom.');
    const label = name.trim() || (type === 'depense' ? category : type === 'transfert' ? 'Transfert' : incomeType === 'petite' ? 'Petite somme' : 'Salaire');
    const ok = await run(async (repo, clientKey) => {
      switch (type) {
        case 'portefeuille':
          await repo.addWallet({ name: label, kind, everyday: kind !== 'epargne', openingBalance: amount });
          return;
        case 'depense':
          return repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount, date, label, category });
        case 'mensuelle': {
          // Première fois : ce mois-ci si le jour n'est pas encore passé, sinon le mois prochain.
          const first = `${today.slice(0, 8)}01`;
          const start = day >= Number(today.slice(8)) ? first : `${addDays(first, 31).slice(0, 8)}01`;
          return repo.addRecurring({ label, kind: monthlyKind, amount, day, start, walletId, category: monthlyKind === 'sortie' ? category : undefined });
        }
        case 'transfert':
          return repo.recordOperation({ clientKey, kind: 'transfert', walletId, toWalletId, amount, fee: fee ?? 0, date, label });
        case 'revenu':
          return repo.recordOperation({ clientKey, kind: 'rentree', walletId, amount, date, label, incomeType });
        default:
          return repo.addPlanned({ kind: type, label, amount, date, walletId, certainty: type === 'rentree' ? sure : undefined, source: type === 'rentree' ? 'revenu' : 'facture' });
      }
    });
    if (ok) router.back();
  }

  const accountTiles = (list: typeof wallets) => list.map((w) => ({ value: w.id, label: w.name, icon: walletIcon(w.kind) }));

  return (
    <Screen>
      {wallets.length > 0 && MAIN.some((m) => m.value === type) ? (
        <Choice label="" value={type} onChange={changeType}
          options={[{ value: 'depense', label: 'Dépense' }, { value: 'revenu', label: 'Revenu' }, { value: 'transfert', label: 'Transfert' }]} />
      ) : null}

      <AmountField label={TITLE[type]} value={amount} onChange={setAmount} autoFocus />

      {type === 'depense' ? <TileChoice label="Catégorie" rowIcon="pricetag-outline" value={category} onChange={setCategory} options={CATEGORY_TILES} /> : null}

      {type === 'revenu' ? (
        <TileChoice label="Quel genre d’argent ?" value={incomeType} onChange={setIncomeType} options={[
          { value: 'petite', label: 'Petite somme', sub: 'cadeau, dépannage, vente', icon: 'cash-outline' },
          { value: 'principal', label: 'Salaire', sub: 'ou revenu habituel', icon: 'briefcase-outline' },
        ]} />
      ) : null}

      {type === 'mensuelle' ? (
        <>
          <TileChoice label="C’est…" value={monthlyKind} onChange={setMonthlyKind} options={[
            { value: 'sortie', label: 'Une facture', sub: 'loyer, CIE, tontine…', icon: 'receipt-outline' },
            { value: 'rentree', label: 'Mon salaire', sub: 'revenu chaque mois', icon: 'briefcase-outline' },
          ]} />
          <Field label={monthlyKind === 'sortie' ? 'Nom (ex. Loyer, CIE, SODECI, Tontine)' : 'Nom (ex. Salaire)'} value={name} onChangeText={setName} />
          <DayOfMonthField label={monthlyKind === 'sortie' ? 'À payer le' : 'Reçu le'} value={day} onChange={setDay} />
          {monthlyKind === 'sortie' ? <TileChoice label="Catégorie" rowIcon="pricetag-outline" value={category} onChange={setCategory} options={CATEGORY_TILES} /> : null}
        </>
      ) : null}

      {type === 'sortie' || type === 'rentree' ? (
        <Field label={type === 'sortie' ? 'Nom (ex. Frais de scolarité)' : 'Nom (ex. Prime, client qui me paie)'} value={name} onChangeText={setName} />
      ) : null}
      {type === 'rentree' ? (
        <TileChoice label="Êtes-vous sûr de le recevoir ?" value={sure} onChange={setSure} options={[
          { value: 'attendue', label: 'Oui, à cette date', icon: 'checkmark-circle-outline' },
          { value: 'incertaine', label: 'Pas sûr', sub: 'pas compté dans le calcul', icon: 'help-circle-outline' },
        ]} />
      ) : null}

      {type === 'portefeuille' ? (
        <>
          <TileChoice label="Quel compte ?" value={kind} onChange={(k) => { setKind(k); setName(WALLET_TILES.find((w) => w.value === k)!.label); }} options={WALLET_TILES} />
          <Field label="Nom" value={name} onChangeText={setName} placeholder="Wave" />
        </>
      ) : (
        <TileChoice label={type === 'transfert' ? 'Depuis' : 'Compte'} rowIcon="wallet-outline"
          value={walletId} onChange={setWalletId} options={accountTiles(type === 'transfert' ? wallets : everyday)} />
      )}

      {type === 'transfert' ? (
        <>
          <TileChoice label="Vers" rowIcon="arrow-forward-circle-outline" value={toWalletId} onChange={setToWalletId} options={accountTiles(wallets.filter((w) => w.id !== walletId))} />
          <AmountField label="Frais payés (si il y en a)" value={fee} onChange={setFee} />
        </>
      ) : null}

      {type !== 'mensuelle' && type !== 'portefeuille' ? (
        <DateField label="Date" value={date} onChange={setDate} today={today}
          max={['depense', 'revenu', 'transfert'].includes(type) ? today : undefined}
          min={['sortie', 'rentree'].includes(type) ? today : undefined} />
      ) : null}

      {['depense', 'revenu', 'transfert'].includes(type) ? <Field label="" icon="document-text-outline" placeholder="Note (facultatif)" value={name} onChangeText={setName} /> : null}

      {error ? <Status tone="risque">{error}</Status> : null}
      <Button label="Enregistrer" disabled={busy} onPress={save} />

      {wallets.length ? (
        <View style={{ gap: 8, paddingTop: 8 }}>
          <Pressable onPress={() => setShowMore(!showMore)} accessibilityRole="button" accessibilityState={{ expanded: showMore }}>
            <Text style={{ color: C.violet, fontWeight: '700', fontSize: 15 }}>{showMore ? '− Moins d’options' : '+ Facture du mois, argent attendu, nouveau compte…'}</Text>
          </Pressable>
          {showMore ? (
            <TileChoice label="Noter aussi" value={type} onChange={changeType} options={MORE} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
