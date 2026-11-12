import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { AmountField, DateField, DayOfMonthField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, categoryStatus, currentCycle, cycleBounds, formatDateFr, formatFcfa, parseFcfa } from '@/domain';

export default function Enveloppes() {
  const { snapshot } = useFinance();
  const w = useWrite('reglages');
  const [day, setDay] = useState(String(snapshot?.cycle?.startDay ?? 1));
  const [mode, setMode] = useState<'mensuel' | 'libre'>(snapshot?.cycle?.freeStart ? 'libre' : 'mensuel');
  const [next, setNext] = useState(snapshot?.cycle?.freeNextStart ?? '');
  const [category, setCategory] = useState('');
  const [cap, setCap] = useState('');
  const [pleasure, setPleasure] = useState<'oui' | 'non'>('non');
  if (!snapshot) return <Screen><Title>Limites de dépenses</Title></Screen>;

  const cycle = currentCycle(snapshot);
  const statuses = categoryStatus(snapshot.categories ?? [], snapshot.operations ?? [], cycle);
  const d = Number(day);
  const preview = d >= 1 && d <= 31 ? cycleBounds(snapshot.today, { startDay: d }) : null;

  async function saveCycle() {
    if (mode === 'mensuel') {
      if (!preview) return w.setError('Jour entre 1 et 31.');
      await w.run((r) => r.saveCycle({ startDay: d }));
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next <= snapshot!.today) return w.setError('Choisissez une date dans le futur.');
      await w.run((r) => r.saveCycle({ startDay: snapshot!.cycle?.startDay ?? 1, freeStart: cycle.start, freeNextStart: next }));
    }
  }

  async function saveCap() {
    const value = parseFcfa(cap);
    if (!category.trim() || value === null) return w.setError('Choisissez le poste et la limite.');
    if (await w.run((r) => r.setCategoryCap({ category: category.trim(), cap: value, pleasure: pleasure === 'oui' }))) {
      setCategory('');
      setCap('');
    }
  }

  return (
    <Screen>
      <Title>Limites de dépenses</Title>
      <Card>
        <Label muted>Mois en cours : du {formatDateFr(cycle.start)} au {formatDateFr(cycle.end)}</Label>
        <Choice label="Mon mois commence" value={mode} onChange={setMode}
          options={[{ value: 'mensuel', label: 'Mensuel (jour de paie)' }, { value: 'libre', label: 'Dates libres (revenus irréguliers)' }]} />
        {mode === 'mensuel' ? (
          <>
            <DayOfMonthField label="Mon mois commence le" value={Number(day) || 1} onChange={(d) => setDay(String(d))} />
            {preview ? <Label muted>Avec ce réglage : du {formatDateFr(preview.start)} au {formatDateFr(preview.end)}. Un jour absent du mois tombe au dernier jour.</Label> : null}
          </>
        ) : (
          <DateField label="Prochain début" value={next || addDays(snapshot.today, 7)} onChange={setNext} today={snapshot.today} min={addDays(snapshot.today, 1)} />
        )}
        <Button label="Enregistrer" disabled={w.busy} onPress={saveCycle} />
      </Card>

      <Card>
        <Label muted>Mes limites ce mois-ci</Label>
        {statuses.length === 0 ? <Label>Aucune limite. Exemple : 25 000 F par mois pour les sorties.</Label> : null}
        {statuses.map((c) => (
          <View key={c.category} style={{ gap: 4 }}>
            <Status tone={c.status === 'depasse' ? 'risque' : c.status === 'presque' ? 'attention' : 'ok'}>
              {c.category}{c.pleasure ? ' (plaisir)' : ''} : {formatFcfa(c.spent)} / {formatFcfa(c.cap)}
            </Status>
            <Label muted>{c.left >= 0 ? `Reste ${formatFcfa(c.left)}` : `Dépassé de ${formatFcfa(-c.left)}`}</Label>
            <Button variant="secondaire" label={`Retirer la limite ${c.category}`} disabled={w.busy} onPress={() => w.run((r) => r.removeCategoryCap(c.category))} />
          </View>
        ))}
      </Card>

      <Card>
        <Label muted>Ajouter ou changer une limite</Label>
        <Field label="Catégorie (ex. Sorties, Jeux, Achats en ligne)" value={category} onChangeText={setCategory} />
        <AmountField label="Maximum par mois" value={parseFcfa(cap)} onChange={(v) => setCap(v === null ? '' : String(v))} />
        <Choice label="Budget plaisir" value={pleasure} onChange={setPleasure} options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
        {(() => {
          const old = snapshot.categories?.find((c) => c.category === category.trim());
          const v = parseFcfa(cap);
          return old && v !== null ? <Label>Avant :  {formatFcfa(old.cap)} → {formatFcfa(v)} ({v >= old.cap ? '+' : '−'}{formatFcfa(Math.abs(v - old.cap))}).</Label> : null;
        })()}
        {w.error ? <Status tone="risque">{w.error}</Status> : null}
        <Button label="Enregistrer la limite" disabled={w.busy} onPress={saveCap} />
      </Card>
    </Screen>
  );
}
