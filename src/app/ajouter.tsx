import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Choice, Field, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { ConnectionRequiredError } from '@/data/repository';
import { addDays, parseFcfa, type WalletKind } from '@/domain';

type Type = 'portefeuille' | 'sortie' | 'rentree';
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export default function Ajouter() {
  const params = useLocalSearchParams<{ type?: Type }>();
  const { snapshot, write } = useFinance();
  const today = snapshot?.today ?? '';
  const [type, setType] = useState<Type>(params.type ?? (snapshot?.wallets.length ? 'sortie' : 'portefeuille'));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('wave');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(addDays(today || '2026-01-01', 1));
  const [walletId, setWalletId] = useState(snapshot?.wallets[0]?.id ?? '');
  const [certain, setCertain] = useState<'attendue' | 'incertaine'>('attendue');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseFcfa(amount);
    if (!name.trim()) return setError('Indiquez un nom.');
    if (value === null || (type !== 'portefeuille' && value <= 0)) return setError('Montant en francs entiers.');
    if (type !== 'portefeuille' && (!isDate(date) || !walletId)) return setError('Date (AAAA-MM-JJ) et portefeuille requis.');
    setBusy(true);
    setError(null);
    try {
      await write((repo) =>
        type === 'portefeuille'
          ? repo.addWallet({ name: name.trim(), kind, everyday: kind !== 'epargne', openingBalance: value })
          : repo.addPlanned({
              kind: type, label: name.trim(), amount: value, date, walletId,
              certainty: type === 'rentree' ? certain : undefined, source: type === 'rentree' ? 'revenu' : 'facture',
            }),
      );
      router.back();
    } catch (e) {
      setError(e instanceof ConnectionRequiredError ? 'Connexion requise. Votre saisie est conservée, réessayez.' : 'Enregistrement refusé.');
    } finally {
      setBusy(false);
    }
  }

  const wallets = snapshot?.wallets ?? [];
  return (
    <Screen>
      <Choice label="Que voulez-vous ajouter ?" value={type} onChange={setType} options={[
        { value: 'portefeuille', label: 'Portefeuille' },
        ...(wallets.length ? [{ value: 'sortie' as const, label: 'Échéance (loyer, facture…)' }, { value: 'rentree' as const, label: 'Rentrée prévue' }] : []),
      ]} />
      <Card>
        {type === 'portefeuille' ? (
          <>
            <Choice label="Type" value={kind} onChange={(k) => { setKind(k); if (!name) setName(''); }} options={[
              { value: 'wave', label: 'Wave' }, { value: 'orange_money', label: 'Orange Money' },
              { value: 'especes', label: 'Espèces' }, { value: 'banque', label: 'Banque' }, { value: 'epargne', label: 'Épargne' },
            ]} />
            <Field label="Nom du portefeuille" value={name} onChangeText={setName} placeholder="Wave" />
            <Field label="Solde actuel (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="30 000" />
          </>
        ) : (
          <>
            <Field label={type === 'sortie' ? 'Libellé (ex. Loyer)' : 'Libellé (ex. Salaire)'} value={name} onChangeText={setName} />
            <Field label="Montant (F CFA)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
            <Choice label="Portefeuille" value={walletId} onChange={setWalletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
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
