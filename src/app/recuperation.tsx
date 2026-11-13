import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Label, Screen, Status, Title } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { supabase } from '@/lib/supabase';

/**
 * Récupération d'accès par code à 6 chiffres reçu par e-mail et saisi ici :
 * aucun lien ni jeton ne transite par un schéma d'URL qu'une autre application pourrait intercepter.
 */
export default function Recuperation() {
  const { openAccount } = useFinance();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'risque'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const msg = String((e as Error)?.message ?? e);
    setMessage({ tone: 'risque', text: /fetch|network/i.test(msg) ? 'Connexion requise : le serveur ne répond pas.' : 'Code invalide ou expiré.' });
  };

  async function sendCode() {
    if (!supabase || !email.includes('@')) return setMessage({ tone: 'risque', text: 'Adresse e-mail invalide.' });
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setStep('code');
      setMessage({ tone: 'ok', text: 'Si un compte existe pour cette adresse, un code à 6 chiffres vient d’être envoyé.' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!supabase) return;
    if (!/^\d{6}$/.test(code.trim())) return setMessage({ tone: 'risque', text: 'Le code contient 6 chiffres.' });
    if (password.length < 8) return setMessage({ tone: 'risque', text: 'Mot de passe : 8 caractères minimum.' });
    setBusy(true);
    try {
      const v = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
      if (v.error) throw v.error;
      const u = await supabase.auth.updateUser({ password });
      if (u.error) throw u.error;
      openAccount();
      router.replace('/');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Récupérer mon accès</Title>
      <Card>
        <Field label="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {step === 'email' ? (
          <Button label="Recevoir un code" disabled={busy} onPress={sendCode} />
        ) : (
          <>
            <Field label="Code reçu par e-mail (6 chiffres)" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
            <Field label="Nouveau mot de passe (8 caractères minimum)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <Button label="Valider" disabled={busy} onPress={confirm} />
            <Button variant="secondaire" label="Renvoyer un code" disabled={busy} onPress={sendCode} />
          </>
        )}
        {message ? <Status tone={message.tone}>{message.text}</Status> : null}
        <Label muted>Le code expire au bout de 10 minutes.</Label>
      </Card>
    </Screen>
  );
}
