import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Choice, Field, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, parseFcfa, type WalletKind } from '@/domain';

type Type = 'depense' | 'revenu' | 'sortie' | 'rentree' | 'portefeuille';
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const CATEGORIES = ['Alimentation', 'Transport', 'Loisirs', 'Habillement', 'Maison', 'Famille', 'Autre'];

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
  const [category, setCategory] = useState('Alimentation');
  const [incomeType, setIncomeType] = useState<'principal' | 'petite'>('petite');
  const [certain, setCertain] = useState<'attendue' | 'incertaine'>('attendue');
  const { run, busy, error, setError } = useWrite('saisie');

  function changeType(t: Type) {
    setType(t);
    setDate(t === 'depense' || t === 'revenu' ? today : addDays(today, 1));
  }

  async function save() {
    const value = parseFcfa(amount);
    const real = type === 'depense' || type === 'revenu';
    if (value === null || (type !== 'portefeuille' && value <= 0)) return setError('Montant en francs entiers.');
    if (type !== 'portefeuille' && (!isDate(date) || !walletId)) return setError('Date (AAAA-MM-JJ) et portefeuille requis.');
    if (real && date > today) return setError('Une opération réelle ne peut pas être dans le futur : utilisez une échéance.');
    if ((type === 'portefeuille' || type === 'sortie' || type === 'rentree') && !name.trim()) return setError('Indiquez un nom.');
    const label = name.trim() || (type === 'depense' ? category : incomeType === 'petite' ? 'Petite somme' : 'Revenu');
    const ok = await run((repo, clientKey) => {
      switch (type) {
        case 'portefeuille':
          return repo.addWallet({ name: label, kind, everyday: kind !== 'epargne', openingBalance: value });
        case 'depense':
          return repo.recordOperation({ clientKey, kind: 'sortie', walletId, amount: value, date, label, category });
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

  const real = type === 'depense' || type === 'revenu';
  return (
    <Screen>
      <Choice label="Que voulez-vous ajouter ?" value={type} onChange={changeType} options={[
        ...(wallets.length ? [
          { value: 'depense' as const, label: 'Dépense' }, { value: 'revenu' as const, label: 'Argent reçu' },
          { value: 'sortie' as const, label: 'Échéance à venir' }, { value: 'rentree' as const, label: 'Rentrée prévue' },
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
            {type === 'depense' ? <Choice label="Catégorie" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /> : null}
            <Field label={real ? 'Libellé (facultatif)' : 'Libellé (ex. Loyer, Salaire)'} value={name} onChangeText={setName} />
            <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={everyday.map((w) => ({ value: w.id, label: w.name }))} />
            <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
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
