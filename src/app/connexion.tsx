import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, C, Card, Field, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function Connexion() {
  const { startDemo, openAccount, repo, restoring } = useFinance();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'risque'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
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

  // Session déjà ouverte (relue au démarrage) : directement à l'accueil.
  if (repo && !restoring) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 16 }}>
        <Image source={require('@/assets/images/mf-icon.png')} style={{ width: 110, height: 110, borderRadius: 26 }} accessibilityLabel="" />
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.texte }}>Mes Finances</Text>
        <Text style={{ fontSize: 16, color: C.secondaire, textAlign: 'center' }}>Savoir avant de dépenser.</Text>
      </View>
      <Text style={{ fontSize: 30, fontWeight: '800', color: C.texte, marginTop: 12 }} accessibilityRole="header">
        {awaitingCode ? 'Confirmer mon adresse' : 'Connexion'}
      </Text>
      {supabaseConfigured ? (
        <>
          <Field label="" icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <View>
            <Field label="" icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry={!showPwd} autoComplete="password" />
            <Pressable onPress={() => setShowPwd(!showPwd)} accessibilityRole="button" accessibilityLabel={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }} hitSlop={10}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={24} color={C.texte} />
            </Pressable>
          </View>
          {message ? <Status tone={message.tone}>{message.text}</Status> : null}
          {awaitingCode ? (
            <>
              <Field label="" icon="keypad-outline" placeholder="Code reçu par e-mail (6 chiffres)" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" autoComplete="one-time-code" />
              <Button label="Confirmer mon adresse" disabled={busy} onPress={confirmCode} />
              <Button label="Renvoyer le code" variant="lien" disabled={busy} onPress={resend} />
            </>
          ) : (
            <>
              <Button label="Se connecter" disabled={busy} onPress={() => auth('connexion')} />
              <Button label="Mot de passe oublié" variant="lien" disabled={busy} onPress={() => router.push('/recuperation')} />
              <Button label="Créer un compte" variant="lien" disabled={busy} onPress={() => auth('inscription')}
                hint="Utilise l’adresse et le mot de passe saisis ci-dessus (8 caractères minimum)" />
            </>
          )}
        </>
      ) : (
        <Card tone="attention"><Status tone="attention">Serveur non configuré : renseignez .env.local (voir README).</Status></Card>
      )}
      <View style={{ height: 1, backgroundColor: C.bord, marginVertical: 4 }} />
      <Button label="Découvrir avec un exemple" variant="secondaire" icon="eye-outline"
        hint="Ouvre un budget d’exemple avec de faux chiffres, séparé de vos données" onPress={() => { startDemo(); router.replace('/'); }} />
    </Screen>
  );
}
