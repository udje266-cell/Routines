import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { categoryStatus, currentCycle, cycleBounds, formatDateFr, formatFcfa, parseFcfa } from '@/domain';

export default function Enveloppes() {
  const { snapshot } = useFinance();
  const w = useWrite('reglages');
  const [day, setDay] = useState(String(snapshot?.cycle?.startDay ?? 1));
  const [mode, setMode] = useState<'mensuel' | 'libre'>(snapshot?.cycle?.freeStart ? 'libre' : 'mensuel');
  const [next, setNext] = useState(snapshot?.cycle?.freeNextStart ?? '');
  const [category, setCategory] = useState('');
  const [cap, setCap] = useState('');
  const [pleasure, setPleasure] = useState<'oui' | 'non'>('non');
  if (!snapshot) return <Screen><Title>Enveloppes</Title></Screen>;

  const cycle = currentCycle(snapshot);
  const statuses = categoryStatus(snapshot.categories ?? [], snapshot.operations ?? [], cycle);
  const d = Number(day);
  const preview = d >= 1 && d <= 31 ? cycleBounds(snapshot.today, { startDay: d }) : null;

  async function saveCycle() {
    if (mode === 'mensuel') {
      if (!preview) return w.setError('Jour entre 1 et 31.');
      await w.run((r) => r.saveCycle({ startDay: d }));
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next <= snapshot!.today) return w.setError('Prochain début : une date future (AAAA-MM-JJ).');
      await w.run((r) => r.saveCycle({ startDay: snapshot!.cycle?.startDay ?? 1, freeStart: cycle.start, freeNextStart: next }));
    }
  }

  async function saveCap() {
    const value = parseFcfa(cap);
    if (!category.trim() || value === null) return w.setError('Catégorie et plafond requis.');
    if (await w.run((r) => r.setCategoryCap({ category: category.trim(), cap: value, pleasure: pleasure === 'oui' }))) {
      setCategory('');
      setCap('');
    }
  }

  return (
    <Screen>
      <Title>Cycle et enveloppes</Title>
      <Card>
        <Label muted>Cycle en cours : du {formatDateFr(cycle.start)} au {formatDateFr(cycle.end)}</Label>
        <Choice label="Type de cycle" value={mode} onChange={setMode}
          options={[{ value: 'mensuel', label: 'Mensuel (jour de paie)' }, { value: 'libre', label: 'Dates libres (revenus irréguliers)' }]} />
        {mode === 'mensuel' ? (
          <>
            <Field label="Jour de début (1 à 31)" value={day} onChangeText={setDay} keyboardType="number-pad" />
            {preview ? <Label muted>Avec ce réglage : du {formatDateFr(preview.start)} au {formatDateFr(preview.end)}. Un jour absent du mois tombe au dernier jour.</Label> : null}
          </>
        ) : (
          <Field label="Prochain début de cycle (AAAA-MM-JJ)" value={next} onChangeText={setNext} />
        )}
        <Button label="Enregistrer le cycle" disabled={w.busy} onPress={saveCycle} />
      </Card>

      <Card>
        <Label muted>Plafonds du cycle</Label>
        {statuses.length === 0 ? <Label>Aucune enveloppe. Ajoutez par exemple « Sorties » en budget plaisir.</Label> : null}
        {statuses.map((c) => (
          <View key={c.category} style={{ gap: 4 }}>
            <Status tone={c.status === 'depasse' ? 'risque' : c.status === 'presque' ? 'attention' : 'ok'}>
              {c.category}{c.pleasure ? ' (plaisir)' : ''} : {formatFcfa(c.spent)} / {formatFcfa(c.cap)}
            </Status>
            <Label muted>{c.left >= 0 ? `Reste ${formatFcfa(c.left)}` : `Dépassé de ${formatFcfa(-c.left)}`}</Label>
            <Button variant="secondaire" label={`Retirer l’enveloppe ${c.category}`} disabled={w.busy} onPress={() => w.run((r) => r.removeCategoryCap(c.category))} />
          </View>
        ))}
      </Card>

      <Card>
        <Label muted>Ajouter ou modifier une enveloppe</Label>
        <Field label="Catégorie (ex. Sorties, Jeux, Achats en ligne)" value={category} onChangeText={setCategory} />
        <Field label="Plafond par cycle (F)" value={cap} onChangeText={setCap} keyboardType="number-pad" />
        <Choice label="Budget plaisir" value={pleasure} onChange={setPleasure} options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
        {(() => {
          const old = snapshot.categories?.find((c) => c.category === category.trim());
          const v = parseFcfa(cap);
          return old && v !== null ? <Label>Conséquence : plafond {formatFcfa(old.cap)} → {formatFcfa(v)} ({v >= old.cap ? '+' : '−'}{formatFcfa(Math.abs(v - old.cap))}).</Label> : null;
        })()}
        {w.error ? <Status tone="risque">{w.error}</Status> : null}
        <Button label="Enregistrer l’enveloppe" disabled={w.busy} onPress={saveCap} />
      </Card>
    </Screen>
  );
}
