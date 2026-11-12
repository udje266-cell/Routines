import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function Connexion() {
  const { startDemo, openAccount } = useFinance();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'risque'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Après l'inscription : confirmation de l'adresse par code à 6 chiffres saisi ici (aucun lien à ouvrir).
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState('');

  async function auth(kind: 'connexion' | 'inscription') {
    if (!supabase) return;
    if (kind === 'inscription' && password.length < 8) return setMessage({ tone: 'risque', text: 'Mot de passe : 8 caractères minimum.' });
    setBusy(true);
    setMessage(null);
    try {
      const res =
        kind === 'connexion' ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (res.error) throw res.error;
      if (kind === 'inscription' && !('session' in res.data && res.data.session)) {
        setAwaitingCode(true);
        return setMessage({ tone: 'ok', text: 'Un code à 6 chiffres vient d’être envoyé à votre adresse. Saisissez-le pour activer le compte.' });
      }
      openAccount();
      router.replace('/');
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      setMessage({ tone: 'risque', text: /fetch|network/i.test(msg) ? 'Connexion requise : le serveur ne répond pas.' : 'Identifiants refusés.' });
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (!supabase) return;
    if (!/^\d{6}$/.test(code.trim())) return setMessage({ tone: 'risque', text: 'Le code contient 6 chiffres.' });
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      openAccount();
      router.replace('/');
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      setMessage({ tone: 'risque', text: /fetch|network/i.test(msg) ? 'Connexion requise : le serveur ne répond pas.' : 'Code invalide ou expiré.' });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setBusy(false);
    setMessage(error ? { tone: 'risque', text: 'Envoi impossible pour le moment, réessayez plus tard.' } : { tone: 'ok', text: 'Nouveau code envoyé.' });
  }

  return (
    <Screen>
      <Image source={require('@/assets/images/mf-logo.png')} style={{ width: '100%', aspectRatio: 2172 / 724 }} contentFit="contain"
        accessibilityLabel="Mes Finances" />
      <Title>Décidez avant de dépenser</Title>
      <Label muted>Testez un achat et voyez tout de suite l’échéance qu’il risque de compromettre.</Label>
      {supabaseConfigured ? (
        <Card>
          <Field label="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {message ? <Status tone={message.tone}>{message.text}</Status> : null}
          {awaitingCode ? (
            <>
              <Field label="Code de confirmation (6 chiffres)" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
              <Button label="Confirmer mon adresse" disabled={busy} onPress={confirmCode} />
              <Button label="Renvoyer le code" variant="secondaire" disabled={busy} onPress={resend} />
            </>
          ) : null}
          <Button label="Se connecter" disabled={busy} onPress={() => auth('connexion')} />
          <Button label="Créer un compte" variant="secondaire" disabled={busy} onPress={() => auth('inscription')} />
          <Button label="Mot de passe oublié" variant="secondaire" disabled={busy} onPress={() => router.push('/recuperation')} />
        </Card>
      ) : (
        <Card tone="attention"><Status tone="attention">Serveur non configuré : renseignez .env.local (voir README).</Status></Card>
      )}
      <Button label="Découvrir avec des données fictives" variant="secondaire"
        hint="Ouvre un budget d’exemple, séparé de vos données" onPress={() => { startDemo(); router.replace('/'); }} />
    </Screen>
  );
}
