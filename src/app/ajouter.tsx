import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AmountField, DateField, DayOfMonthField, TileChoice } from '@/components/inputs';
import { Button, C, Choice, Field, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, formatFcfa, type WalletKind } from '@/domain';
import { CATEGORY_TILES, categoryLabel, WALLET_TILES, walletIcon } from '@/lib/categories';

type Type = 'depense' | 'revenu' | 'transfert' | 'mensuelle' | 'sortie' | 'rentree' | 'portefeuille' | 'tontine' | 'solde';

/** Ce que l'on veut noter, en mots de tous les jours. */
const MAIN: { value: Type; label: string; icon: 'remove-circle-outline' | 'add-circle-outline' | 'swap-horizontal-outline' }[] = [
  { value: 'depense', label: 'J’ai dépensé', icon: 'remove-circle-outline' },
  { value: 'revenu', label: 'J’ai reçu', icon: 'add-circle-outline' },
  { value: 'transfert', label: 'J’ai déplacé', icon: 'swap-horizontal-outline' },
];
const MORE: { value: Type; label: string; sub?: string; icon: 'repeat-outline' | 'time-outline' | 'hourglass-outline' | 'wallet-outline' | 'people-outline' | 'scale-outline' }[] = [
  { value: 'mensuelle', label: 'Facture de chaque mois', icon: 'repeat-outline' },
  { value: 'sortie', label: 'À payer plus tard', icon: 'time-outline' },
  { value: 'rentree', label: 'Argent attendu', icon: 'hourglass-outline' },
  { value: 'tontine', label: 'Tontine', sub: 'cotisation + mon tour', icon: 'people-outline' },
  { value: 'solde', label: 'Corriger un solde', sub: 'mon vrai montant est…', icon: 'scale-outline' },
  { value: 'portefeuille', label: 'Nouveau compte', icon: 'wallet-outline' },
];
/** Catégories proposées en un toucher (les plus utilisées d'abord). */
const QUICK = ['Transport', 'Alimentation', 'Communication', 'Sorties', 'Famille', 'Santé'];
const TITLE: Record<Type, string> = {
  depense: 'Combien avez-vous dépensé ?', revenu: 'Combien avez-vous reçu ?', transfert: 'Combien avez-vous déplacé ?',
  mensuelle: 'Montant chaque mois', sortie: 'Montant à payer', rentree: 'Montant attendu', portefeuille: 'Combien y a-t-il dessus aujourd’hui ?',
  tontine: 'Ma cotisation chaque mois', solde: 'Combien avez-vous vraiment sur ce compte ?',
};

const TYPES: Type[] = ['depense', 'revenu', 'transfert', 'mensuelle', 'sortie', 'rentree', 'portefeuille'];

export default function Ajouter() {
  const { snapshot } = useFinance();
  if (!snapshot) return <Screen><Status tone="attention">Chargement…</Status></Screen>;
  return <AjouterForm />;
}

function AjouterForm() {
  // Paramètres venus d'un lien : seules les valeurs connues sont retenues.
  const raw = useLocalSearchParams<{ type?: string; sens?: string; date?: string }>();
  const params = {
    type: TYPES.includes(raw.type as Type) ? (raw.type as Type) : undefined,
    sens: raw.sens === 'sortie' || raw.sens === 'rentree' ? (raw.sens as 'sortie' | 'rentree') : undefined,
    date: raw.date,
  };
  const { snapshot } = useFinance();
  const today = snapshot?.today ?? '2026-01-01';
  const wallets = snapshot?.wallets ?? [];
  const everyday = wallets.filter((w) => w.everyday);
  // Depuis le calendrier : un jour passé = opération réelle, un jour à venir = chose prévue.
  const fromDay = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const initialType: Type = (() => {
    const t = params.type ?? (wallets.length ? 'depense' : 'portefeuille');
    if (!fromDay || fromDay <= today) return t === 'sortie' ? 'depense' : t === 'rentree' ? 'revenu' : t;
    return t === 'depense' ? 'sortie' : t === 'revenu' ? 'rentree' : t;
  })();
  const [type, setType] = useState<Type>(initialType);
  const [showMore, setShowMore] = useState(MORE.some((m) => m.value === type));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('wave');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(fromDay ?? (['depense', 'revenu', 'transfert'].includes(initialType) ? today : addDays(today, 1)));
  // Le dernier compte utilisé est proposé d'abord.
  const lastWallet = [...(snapshot?.operations ?? [])].reverse().find((o) => o.kind !== 'transfert' && everyday.some((w) => w.id === o.walletId))?.walletId;
  const [walletId, setWalletId] = useState(lastWallet ?? everyday[0]?.id ?? '');
  const [tourDate, setTourDate] = useState(addDays(today, 30));
  const [tourAmount, setTourAmount] = useState<number | null>(null);
  const [categoryState, setCategory] = useState(type === 'mensuelle' ? 'Logement' : 'Alimentation');
  const category = categoryState;
  const [incomeType, setIncomeType] = useState<'principal' | 'petite'>('petite');
  const [sure, setSure] = useState<'attendue' | 'incertaine'>('attendue');
  const [day, setDay] = useState(Number((fromDay ?? today).slice(8)) || 1);
  const [toWalletId, setToWalletId] = useState(wallets.find((x) => x.id !== everyday[0]?.id)?.id ?? '');
  const [fee, setFee] = useState<number | null>(null);
  const [monthlyKind, setMonthlyKind] = useState<'sortie' | 'rentree'>(params.sens ?? 'sortie');
  const { run, busy, error, setError, result } = useWrite('saisie');
  const { notify } = useFinance();

  function changeType(t: Type) {
    setType(t);
    setError(null);
    setCategory(t === 'mensuelle' ? 'Logement' : 'Alimentation');
    setDate(['depense', 'revenu', 'transfert'].includes(t) ? today : addDays(today, 1));
  }

  async function save(quickCategory?: string) {
    const category = quickCategory ?? categoryState;
    const real = type === 'depense' || type === 'revenu' || type === 'transfert';
    if (amount === null || (type !== 'portefeuille' && amount <= 0)) return setError('Indiquez le montant.');
    if (type === 'transfert' && (!toWalletId || toWalletId === walletId)) return setError('Choisissez deux comptes différents.');
    if (type !== 'portefeuille' && !walletId) return setError('Choisissez le compte.');
    if (real && date > today) return setError('Cette date est dans le futur : utilisez « À payer plus tard » ou « Argent attendu ».');
    if (['portefeuille', 'sortie', 'rentree', 'mensuelle'].includes(type) && !name.trim()) return setError('Donnez-lui un nom.');
    const fixWallet = wallets.find((w) => w.id === walletId);
    const diff = type === 'solde' && fixWallet ? amount - fixWallet.balance : 0;
    if (type === 'solde' && diff === 0) return setError('Le solde est déjà juste : rien à corriger.');
    const label = name.trim() || (type === 'depense' ? categoryLabel(category) : type === 'transfert' ? 'Transfert' : type === 'tontine' ? 'Tontine'
      : type === 'solde' ? 'Correction du solde' : incomeType === 'petite' ? 'Petite somme' : 'Salaire');
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
        case 'tontine': {
          const first = `${today.slice(0, 8)}01`;
          const start = day >= Number(today.slice(8)) ? first : `${addDays(first, 31).slice(0, 8)}01`;
          await repo.addRecurring({ label, kind: 'sortie', amount, day, start, walletId, category: 'Famille' });
          if (tourAmount) await repo.addPlanned({ kind: 'rentree', label: `${label} : mon tour`, amount: tourAmount, date: tourDate, walletId, certainty: 'attendue', source: 'revenu' });
          return;
        }
        case 'solde':
          // L'écart entre le solde noté et le vrai solde : une sortie ou une entrée « Correction du solde ».
          return repo.recordOperation({ clientKey, kind: diff < 0 ? 'sortie' : 'rentree', walletId, amount: Math.abs(diff), date: today, label, category: 'Autre',
            incomeType: diff > 0 ? 'petite' : undefined });
        case 'transfert':
          return repo.recordOperation({ clientKey, kind: 'transfert', walletId, toWalletId, amount, fee: fee ?? 0, date, label });
        case 'revenu':
          return repo.recordOperation({ clientKey, kind: 'rentree', walletId, amount, date, label, incomeType });
        default:
          return repo.addPlanned({ kind: type, label, amount, date, walletId, certainty: type === 'rentree' ? sure : undefined, source: type === 'rentree' ? 'revenu' : 'facture' });
      }
    }, { type, name, kind, amount, date, walletId, category, incomeType, sure, day, toWalletId, fee, monthlyKind, tourDate, tourAmount });
    if (!ok) return;
    const id = typeof result.current === 'string' ? result.current : null;
    const what = type === 'solde' ? `Solde corrigé (${diff > 0 ? '+' : '−'}${formatFcfa(Math.abs(diff))})` : `${label} · ${formatFcfa(amount)} enregistré`;
    notify(what, id ? (r) => r.deleteOperation(id) : undefined);
    router.back();
  }

  // Frais Wave / Orange Money : d'après le dernier transfert sur le même trajet (pas de barème inventé).
  const lastSameRoute = [...(snapshot?.operations ?? [])].reverse().find((o) => o.kind === 'transfert' && o.walletId === walletId && o.toWalletId === toWalletId && (o.fee ?? 0) > 0);
  const suggestedFee = lastSameRoute && amount ? Math.round((amount * lastSameRoute.fee!) / lastSameRoute.amount) : null;

  const accountTiles = (list: typeof wallets) => list.map((w) => ({ value: w.id, label: w.name, icon: walletIcon(w.kind) }));

  return (
    <Screen>
      {wallets.length > 0 && MAIN.some((m) => m.value === type) ? (
        <Choice label="" value={type} onChange={changeType}
          options={[{ value: 'depense', label: 'J’ai dépensé' }, { value: 'revenu', label: 'J’ai reçu' }, { value: 'transfert', label: 'J’ai déplacé' }]} />
      ) : null}

      <AmountField label={TITLE[type]} value={amount} onChange={setAmount} autoFocus />

      {type === 'depense' ? (
        <>
          <Text style={{ fontSize: 14, color: C.secondaire }}>Touchez une catégorie pour enregistrer tout de suite :</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((v) => CATEGORY_TILES.find((c) => c.value === v)!).map((c) => (
              <Pressable key={c.value} disabled={busy} accessibilityRole="button" accessibilityLabel={`${c.label} : enregistrer la dépense`}
                onPress={() => { setCategory(c.value); if (amount && amount > 0) void save(c.value); else setError('Indiquez d’abord le montant.'); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22,
                  backgroundColor: category === c.value ? C.violet : C.violetClair, opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name={c.icon} size={18} color={category === c.value ? '#fff' : C.texte} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: category === c.value ? '#fff' : C.texte }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          <TileChoice label="Autre catégorie" rowIcon="pricetag-outline" value={category} onChange={setCategory} options={CATEGORY_TILES} />
        </>
      ) : null}

      {type === 'tontine' ? (
        <>
          <Field label="Nom (ex. Tontine du quartier)" value={name} onChangeText={setName} placeholder="Tontine" />
          <DayOfMonthField label="Je cotise le" value={day} onChange={setDay} />
          <AmountField label="Quand c’est mon tour, je reçois" value={tourAmount} onChange={setTourAmount} />
          {tourAmount ? <DateField label="Mon tour" value={tourDate} onChange={setTourDate} today={today} min={today} /> : null}
          <Status tone="ok">La cotisation devient une facture de chaque mois ; votre tour, de l’argent attendu.</Status>
        </>
      ) : null}
      {type === 'solde' ? (
        <Status tone="attention">L’écart avec ce qui est noté sera enregistré comme « Correction du solde ».</Status>
      ) : null}

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
          <AmountField label="Frais payés (s’il y en a)" value={fee} onChange={setFee} />
          {suggestedFee && fee === null ? (
            <Pressable onPress={() => setFee(suggestedFee)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: C.violet, fontWeight: '700', fontSize: 15 }}>Frais habituels sur ce trajet : {formatFcfa(suggestedFee)} · utiliser</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {!['mensuelle', 'portefeuille', 'tontine', 'solde'].includes(type) ? (
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
