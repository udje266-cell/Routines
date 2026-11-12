import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Choice, Field, Label, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, parseFcfa, type WalletKind } from '@/domain';

type Type = 'depense' | 'revenu' | 'transfert' | 'mensuelle' | 'sortie' | 'rentree' | 'portefeuille';
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const CATEGORIES = ['Logement', 'Alimentation', 'Transport', 'Scolarité', 'Santé', 'Famille', 'Loisirs', 'Habillement', 'Autre'];

export default function Ajouter() {
  const params = useLocalSearchParams<{ type?: Type }>();
  const { snapshot } = useFinance();
  const today = snapshot?.today ?? '2026-01-01';
  const wallets = snapshot?.wallets ?? [];
  const everyday = wallets.filter((w) => w.everyday);
  const [type, setType] = useState<Type>(params.type ?? (wallets.length ? 'depense' : 'portefeuille'));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('wave');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(type === 'depense' || type === 'revenu' ? today : addDays(today, 1));
  const [walletId, setWalletId] = useState(everyday[0]?.id ?? '');
  const [category, setCategory] = useState(params.type === 'mensuelle' ? 'Logement' : 'Alimentation');
  const [incomeType, setIncomeType] = useState<'principal' | 'petite'>('petite');
  const [certain, setCertain] = useState<'attendue' | 'incertaine'>('attendue');
  const [day, setDay] = useState(String(Number(today.slice(8)) || 1));
  const [toWalletId, setToWalletId] = useState(wallets.find((x) => x.id !== everyday[0]?.id)?.id ?? '');
  const [fee, setFee] = useState('');
  const [monthlyKind, setMonthlyKind] = useState<'sortie' | 'rentree'>('sortie');
  const { run, busy, error, setError } = useWrite('saisie');

  function changeType(t: Type) {
    setType(t);
    setCategory(t === 'mensuelle' ? 'Logement' : 'Alimentation');
    setDate(t === 'depense' || t === 'revenu' || t === 'transfert' ? today : addDays(today, 1));
  }

  async function save() {
    const value = parseFcfa(amount);
    const real = type === 'depense' || type === 'revenu' || type === 'transfert';
    const feeValue = fee ? parseFcfa(fee) : 0;
    if (type === 'transfert' && (!toWalletId || toWalletId === walletId)) return setError('Choisissez deux portefeuilles différents.');
    if (type === 'transfert' && feeValue === null) return setError('Frais en francs entiers.');
    if (value === null || (type !== 'portefeuille' && value <= 0)) return setError('Montant en francs entiers.');
    if (type !== 'portefeuille' && (!isDate(date) || !walletId)) return setError('Date (AAAA-MM-JJ) et portefeuille requis.');
    if (real && date > today) return setError('Une opération réelle ne peut pas être dans le futur : utilisez une échéance.');
    if ((type === 'portefeuille' || type === 'sortie' || type === 'rentree' || type === 'mensuelle') && !name.trim()) return setError('Indiquez un nom.');
    const d = Number(day);
    if (type === 'mensuelle' && !(d >= 1 && d <= 31)) return setError('Jour du mois entre 1 et 31.');
    const label = name.trim() || (type === 'depense' ? category : type === 'transfert' ? 'Transfert' : incomeType === 'petite' ? 'Petite somme' : 'Revenu');
    const ok = await run((repo, clientKey) => {
      switch (type) {
        case 'portefeuille':
          return repo.addWallet({ name: label, kind, everyday: kind !== 'epargne', openingBalance: value });
        case 'depense':
          return repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label, category });
        case 'mensuelle': {
          // Première occurrence : ce mois-ci si le jour n'est pas encore passé, sinon le mois prochain.
          const start = d >= Number(today.slice(8)) ? `${today.slice(0, 8)}01` : addDays(`${today.slice(0, 8)}01`, 31).slice(0, 8) + '01';
          return repo.addRecurring({ label, kind: monthlyKind, amount: value, day: d, start, walletId, category: monthlyKind === 'sortie' ? category : undefined });
        }
        case 'transfert':
          // Une seule opération atomique ; seuls les frais comptent comme dépense.
          return repo.recordOperation({ clientKey, kind: 'transfert', walletId, toWalletId, amount: value, fee: feeValue ?? 0, date, label: label || 'Transfert' });
        case 'revenu':
          return repo.recordOperation({ clientKey, kind: 'rentree', walletId, amount: value, date, label, incomeType });
        default:
          return repo.addPlanned({
            kind: type, label, amount: value, date, walletId,
            certainty: type === 'rentree' ? certain : undefined, source: type === 'rentree' ? 'revenu' : 'facture',
          });
      }
    });
    if (ok) router.back();
  }

  const real = type === 'depense' || type === 'revenu' || type === 'transfert';
  return (
    <Screen>
      <Choice label="Que voulez-vous ajouter ?" value={type} onChange={changeType} options={[
        ...(wallets.length ? [
          { value: 'depense' as const, label: 'Dépense' }, { value: 'revenu' as const, label: 'Argent reçu' },
          { value: 'transfert' as const, label: 'Transfert' },
          { value: 'mensuelle' as const, label: 'Dépense chaque mois' },
          { value: 'sortie' as const, label: 'Échéance ponctuelle' }, { value: 'rentree' as const, label: 'Rentrée prévue' },
        ] : []),
        { value: 'portefeuille', label: 'Portefeuille' },
      ]} />
      <Card>
        {type === 'portefeuille' ? (
          <>
            <Choice label="Type" value={kind} onChange={setKind} options={[
              { value: 'wave', label: 'Wave' }, { value: 'orange_money', label: 'Orange Money' },
              { value: 'especes', label: 'Espèces' }, { value: 'banque', label: 'Banque' }, { value: 'epargne', label: 'Épargne' },
            ]} />
            <Field label="Nom du portefeuille" value={name} onChangeText={setName} placeholder="Wave" />
            <Field label="Solde actuel (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="30 000" />
          </>
        ) : (
          <>
            <Field label="Montant (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" autoFocus={real} />
            {type === 'revenu' ? (
              <Choice label="Type de rentrée" value={incomeType} onChange={setIncomeType} options={[
                { value: 'petite', label: 'Petite somme (coupure, dépannage…)' }, { value: 'principal', label: 'Revenu principal' },
              ]} />
            ) : null}
            {type === 'mensuelle' ? (
              <>
                <Choice label="Type" value={monthlyKind} onChange={setMonthlyKind} options={[
                  { value: 'sortie', label: 'Dépense obligatoire' }, { value: 'rentree', label: 'Revenu mensuel (salaire…)' },
                ]} />
                <Field label="Jour du mois (1 à 31)" value={day} onChangeText={setDay} keyboardType="number-pad" />
                <Label muted>Un jour absent d’un mois court (29, 30, 31) tombe au dernier jour du mois.</Label>
              </>
            ) : null}
            {type === 'depense' || (type === 'mensuelle' && monthlyKind === 'sortie') ? <Choice label="Catégorie" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /> : null}
            <Field label={real ? 'Libellé (facultatif)' : type === 'mensuelle' ? 'Libellé (ex. Loyer, CIE, SODECI, Internet, Tontine)' : 'Libellé (ex. Loyer, Salaire)'}
              value={name} onChangeText={setName} />
            <Choice label={type === 'transfert' ? 'Depuis' : 'Portefeuille'} value={walletId} onChange={setWalletId}
              options={(type === 'transfert' ? wallets : everyday).map((w) => ({ value: w.id, label: w.name }))} />
            {type === 'transfert' ? (
              <>
                <Choice label="Vers" value={toWalletId} onChange={setToWalletId}
                  options={wallets.filter((w) => w.id !== walletId).map((w) => ({ value: w.id, label: w.name }))} />
                <Field label="Frais (F, facultatif)" value={fee} onChangeText={setFee} keyboardType="number-pad" placeholder="0" />
                <Label muted>Le total du quotidien ne change pas, sauf des frais. Pour épargner sur un objectif, utilisez l’onglet Épargne.</Label>
              </>
            ) : null}
            {type !== 'mensuelle' ? <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} /> : null}
            {type === 'rentree' ? (
              <Choice label="Certitude" value={certain} onChange={setCertain} options={[
                { value: 'attendue', label: 'Attendue à cette date' }, { value: 'incertaine', label: 'Incertaine' },
              ]} />
            ) : null}
          </>
        )}
        {error ? <Status tone="risque">{error}</Status> : null}
        <Button label="Enregistrer" disabled={busy} onPress={save} />
      </Card>
    </Screen>
  );
}
