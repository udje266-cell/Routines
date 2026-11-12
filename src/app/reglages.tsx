import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Choice, Field, Label, Screen, Status, Title } from '@/components/ui';
import { NumberField } from '@/components/inputs';
import { useFinance } from '@/data/finance-context';
import { ConnectionRequiredError, RefusedError } from '@/data/repository';
import { ensurePermission } from '@/lib/notifications';
import { lockAvailable } from '@/lib/verrou';

export default function Reglages() {
  const { prefs, setPrefs, repo, deleteAccount } = useFinance();
  const [message, setMessage] = useState<{ tone: 'ok' | 'risque' | 'attention'; text: string } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const native = Platform.OS !== 'web';
  const r = prefs.reminders;

  async function toggleLock(v: 'oui' | 'non') {
    if (v === 'oui' && !(await lockAvailable().catch(() => false)))
      return setMessage({ tone: 'attention', text: 'Aucune empreinte ni code configuré sur ce téléphone.' });
    await setPrefs({ ...prefs, lock: v === 'oui' });
    setMessage(null);
  }

  async function toggleReminders(v: 'oui' | 'non') {
    if (v === 'oui' && !(await ensurePermission().catch(() => false)))
      return setMessage({ tone: 'attention', text: 'Notifications refusées : autorisez-les dans les réglages Android.' });
    await setPrefs({ ...prefs, reminders: { ...r, enabled: v === 'oui' } });
    setMessage(null);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteAccount();
      router.replace('/connexion');
    } catch (e) {
      setMessage({
        tone: 'risque',
        text: e instanceof ConnectionRequiredError ? 'Connexion requise : rien n’a été supprimé.' : e instanceof RefusedError ? e.message : 'Suppression refusée.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Réglages</Title>
      {message ? <Card tone={message.tone}><Status tone={message.tone}>{message.text}</Status></Card> : null}

      <Card>
        <Label muted>Verrouillage</Label>
        {native ? (
          <Choice label="Demander l’empreinte ou le code à l’ouverture" value={prefs.lock ? 'oui' : 'non'} onChange={toggleLock}
            options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
        ) : <Label muted>Disponible sur le téléphone.</Label>}
      </Card>

      <Card>
        <Label muted>Rappels (facultatifs)</Label>
        {native ? (
          <>
            <Choice label="Recevoir des rappels" value={r.enabled ? 'oui' : 'non'} onChange={toggleReminders}
              options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
            {r.enabled ? (
              <>
                <Choice label="Échéances" value={String(r.daysBefore) as '0' | '1' | '2'}
                  onChange={(v) => setPrefs({ ...prefs, reminders: { ...r, daysBefore: Number(v) } })}
                  options={[{ value: '0', label: 'Le jour même' }, { value: '1', label: 'La veille' }, { value: '2', label: '2 jours avant' }]} />
                <NumberField label="Heure d’envoi (0 à 23)" value={String(r.hour)}
                  onChange={(t) => { const h = Number(t); if (t !== '' && h >= 0 && h <= 23) setPrefs({ ...prefs, reminders: { ...r, hour: h } }); }} />
                <Choice label="Afficher noms et montants dans les notifications" value={r.showDetails ? 'oui' : 'non'}
                  onChange={(v) => setPrefs({ ...prefs, reminders: { ...r, showDetails: v === 'oui' } })}
                  options={[{ value: 'non', label: 'Non (recommandé)' }, { value: 'oui', label: 'Oui' }]} />
                <Label muted>Par défaut, une notification dit seulement « Une échéance arrive demain ». Sur l’écran verrouillé, le contenu reste masqué.</Label>
              </>
            ) : null}
          </>
        ) : <Label muted>Disponible sur le téléphone.</Label>}
      </Card>

      {repo?.mode === 'compte' ? (
        <Card tone="risque">
          <Label muted>Supprimer mon compte</Label>
          <Label>Supprime définitivement votre compte et toutes vos données : comptes, opérations, dettes, épargne, factures du mois. Cette action est irréversible.</Label>
          <Field label="Tapez SUPPRIMER pour confirmer" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
          <Button label="Supprimer définitivement" disabled={busy || confirm.trim() !== 'SUPPRIMER'} onPress={remove} />
        </Card>
      ) : null}
    </Screen>
  );
}
