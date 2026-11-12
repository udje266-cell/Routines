import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AmountField, DayOfMonthField } from '@/components/inputs';
import { Button, C, Card, Label, Screen, Status } from '@/components/ui';
import { useFinance } from '@/data/finance-context';
import { useWrite } from '@/data/use-write';
import { addDays, formatFcfa, monthlyDate, type WalletKind } from '@/domain';

/**
 * Configuration guidée au premier lancement : quatre questions simples, des réponses toutes prêtes,
 * et un premier résultat concret à la fin (« Je peux dépenser aujourd'hui »).
 */

type Account = { kind: WalletKind; name: string; on: boolean; balance: number | null };
type Bill = { key: string; label: string; category: string; icon: keyof typeof Ionicons.glyphMap; on: boolean; amount: number | null; day: number };

const STEPS = ['Mon argent', 'Mon salaire', 'Mes factures', 'Ma sécurité'];

export default function Bienvenue() {
  const { snapshot } = useFinance();
  const today = snapshot?.today ?? '2026-01-01';
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([
    { kind: 'wave', name: 'Wave', on: true, balance: null },
    { kind: 'orange_money', name: 'Orange Money', on: false, balance: null },
    { kind: 'especes', name: 'Espèces', on: true, balance: null },
    { kind: 'banque', name: 'Banque', on: false, balance: null },
  ]);
  const [hasSalary, setHasSalary] = useState(true);
  const [salary, setSalary] = useState<number | null>(null);
  const [payDay, setPayDay] = useState(28);
  const [salaryAccount, setSalaryAccount] = useState<WalletKind>('wave');
  const [bills, setBills] = useState<Bill[]>([
    { key: 'loyer', label: 'Loyer', category: 'Logement', icon: 'home-outline', on: true, amount: null, day: 5 },
    { key: 'cie', label: 'Électricité (CIE)', category: 'Logement', icon: 'flash-outline', on: true, amount: null, day: 15 },
    { key: 'sodeci', label: 'Eau (SODECI)', category: 'Logement', icon: 'water-outline', on: true, amount: null, day: 15 },
    { key: 'internet', label: 'Internet / téléphone', category: 'Communication', icon: 'wifi-outline', on: false, amount: null, day: 5 },
    { key: 'transport', label: 'Transport du mois', category: 'Transport', icon: 'bus-outline', on: false, amount: null, day: 1 },
    { key: 'tontine', label: 'Tontine', category: 'Famille', icon: 'people-outline', on: false, amount: null, day: 28 },
    { key: 'ecole', label: 'Scolarité', category: 'Scolarité', icon: 'school-outline', on: false, amount: null, day: 5 },
    { key: 'famille', label: 'Aide à la famille', category: 'Famille', icon: 'heart-outline', on: false, amount: null, day: 28 },
  ]);
  const [savingGoal, setSavingGoal] = useState(true);
  const w = useWrite('bienvenue');
  // Ce qui a déjà été créé : un réessai après coupure ne crée rien en double.
  const created = useRef<{ wallets: Partial<Record<WalletKind, string>>; bills: Set<string>; salary: boolean; goal: boolean }>({
    wallets: {}, bills: new Set(), salary: false, goal: false,
  });

  const chosen = accounts.filter((a) => a.on);
  const monthlyBills = bills.filter((b) => b.on && b.amount).reduce((s, b) => s + (b.amount ?? 0), 0);
  const firstOf = (day: number) => {
    // Première occurrence : ce mois-ci si le jour n'est pas passé, sinon le mois prochain.
    const [y, m] = today.split('-').map(Number);
    return monthlyDate(y, m, day) >= today ? `${today.slice(0, 8)}01` : `${addDays(`${today.slice(0, 8)}01`, 31).slice(0, 8)}01`;
  };

  function next() {
    w.setError(null);
    if (step === 0) {
      if (!chosen.length) return w.setError('Choisissez au moins un compte.');
      if (chosen.some((a) => a.balance === null)) return w.setError('Indiquez combien il y a sur chaque compte (0 si vide).');
    }
    if (step === 1 && hasSalary && !salary) return w.setError('Indiquez votre salaire, ou choisissez « Pas de salaire fixe ».');
    if (step === 2 && bills.some((b) => b.on && !b.amount)) return w.setError('Indiquez le montant de chaque facture cochée, ou décochez-la.');
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  async function finish() {
    const ok = await w.run(async (repo) => {
      for (const a of chosen) {
        if (!created.current.wallets[a.kind])
          created.current.wallets[a.kind] = await repo.addWallet({ name: a.name, kind: a.kind, everyday: true, openingBalance: a.balance ?? 0 });
      }
      const main = created.current.wallets[salaryAccount] ?? Object.values(created.current.wallets)[0]!;
      if (hasSalary && salary && !created.current.salary) {
        await repo.addRecurring({ label: 'Salaire', kind: 'rentree', amount: salary, day: payDay, start: firstOf(payDay), walletId: main });
        created.current.salary = true;
      }
      for (const b of bills.filter((x) => x.on && x.amount)) {
        if (created.current.bills.has(b.key)) continue;
        await repo.addRecurring({ label: b.label, kind: 'sortie', amount: b.amount!, day: b.day, start: firstOf(b.day), walletId: main, category: b.category });
        created.current.bills.add(b.key);
      }
      if (savingGoal && monthlyBills > 0 && !created.current.goal) {
        if (!created.current.wallets.epargne)
          created.current.wallets.epargne = await repo.addWallet({ name: 'Épargne', kind: 'epargne', everyday: false, openingBalance: 0 });
        await repo.addGoal({
          name: 'Coussin de sécurité', target: monthlyBills * 3, date: addDays(today, 365),
          pocketWalletId: created.current.wallets.epargne, fromWalletId: main, plannedDay: Math.min(28, payDay + 1),
        });
        created.current.goal = true;
      }
    });
    if (ok) router.replace('/');
  }

  return (
    <Screen>
      {/* Progression */}
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? C.marine : C.lavande }} />
        ))}
      </View>
      <Text style={{ color: C.secondaire, fontSize: 14 }}>Étape {step + 1} sur {STEPS.length}</Text>

      {step === 0 ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.texte }} accessibilityRole="header">Où est votre argent ?</Text>
          <Label muted>Cochez vos comptes et indiquez ce qu’il y a dessus aujourd’hui. Pas besoin d’être exact au franc près.</Label>
          {accounts.map((a, i) => (
            <Card key={a.kind}>
              <Pressable onPress={() => setAccounts(accounts.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                accessibilityRole="checkbox" accessibilityState={{ checked: a.on }} accessibilityLabel={a.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <Ionicons name={a.on ? 'checkbox' : 'square-outline'} size={26} color={C.marine} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.texte }}>{a.name}</Text>
              </Pressable>
              {a.on ? (
                <AmountField label={`Sur ${a.name} aujourd’hui`} value={a.balance}
                  onChange={(v) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, balance: v } : x)))} />
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.texte }} accessibilityRole="header">Votre salaire</Text>
          <Label muted>C’est lui qui permet de calculer combien vous pouvez dépenser chaque jour jusqu’à la prochaine paie.</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[true, 'J’ai un salaire'], [false, 'Pas de salaire fixe']].map(([v, t]) => (
              <Pressable key={String(v)} onPress={() => setHasSalary(v as boolean)} accessibilityRole="radio" accessibilityState={{ checked: hasSalary === v }}
                style={{ flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: hasSalary === v ? C.marine : C.lavandeClair, borderWidth: 1, borderColor: hasSalary === v ? C.marine : C.lavande }}>
                <Text style={{ color: hasSalary === v ? '#fff' : C.texte, fontWeight: '700' }}>{t as string}</Text>
              </Pressable>
            ))}
          </View>
          {hasSalary ? (
            <>
              <AmountField label="Combien recevez-vous chaque mois ?" value={salary} onChange={setSalary} />
              <DayOfMonthField label="Quel jour arrive-t-il ?" value={payDay} onChange={setPayDay} />
              <Label muted>Il arrive sur :</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {chosen.map((a) => (
                  <Pressable key={a.kind} onPress={() => setSalaryAccount(a.kind)} accessibilityRole="radio" accessibilityState={{ checked: salaryAccount === a.kind }}
                    style={{ paddingHorizontal: 16, minHeight: 44, borderRadius: 22, justifyContent: 'center',
                      backgroundColor: salaryAccount === a.kind ? C.marine : '#fff', borderWidth: 1, borderColor: salaryAccount === a.kind ? C.marine : C.lavande }}>
                    <Text style={{ color: salaryAccount === a.kind ? '#fff' : C.texte, fontWeight: '600' }}>{a.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Card tone="attention"><Status tone="attention">Pas de souci : notez chaque somme reçue avec « J’ai reçu ». L’application s’adaptera.</Status></Card>
          )}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.texte }} accessibilityRole="header">Vos factures de chaque mois</Text>
          <Label muted>Ce que vous payez obligatoirement tous les mois. L’application les mettra de côté pour vous et vous préviendra.</Label>
          {bills.map((b, i) => (
            <Card key={b.key}>
              <Pressable onPress={() => setBills(bills.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                accessibilityRole="checkbox" accessibilityState={{ checked: b.on }} accessibilityLabel={b.label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <Ionicons name={b.on ? 'checkbox' : 'square-outline'} size={26} color={C.marine} />
                <Ionicons name={b.icon} size={22} color={C.secondaire} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.texte, flex: 1 }}>{b.label}</Text>
              </Pressable>
              {b.on ? (
                <>
                  <AmountField label="Montant par mois" value={b.amount} onChange={(v) => setBills(bills.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                  <DayOfMonthField label="À payer le" value={b.day} onChange={(d) => setBills(bills.map((x, j) => (j === i ? { ...x, day: d } : x)))} />
                </>
              ) : null}
            </Card>
          ))}
          {monthlyBills ? <Status tone="ok">Total de vos factures : {formatFcfa(monthlyBills)} par mois.</Status> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.texte }} accessibilityRole="header">Un coussin de sécurité</Text>
          <Label>
            Un coussin de sécurité, c’est de l’argent mis de côté pour les coups durs : maladie, panne, salaire en retard. Les spécialistes
            conseillent d’avoir l’équivalent de 3 mois de factures.
          </Label>
          {monthlyBills ? (
            <Card tone="ok">
              <Status tone="ok">Votre objectif : {formatFcfa(monthlyBills * 3)} en un an.</Status>
              <Label>Soit environ {formatFcfa(Math.ceil((monthlyBills * 3) / 12))} à mettre de côté chaque mois, juste après la paie.</Label>
            </Card>
          ) : <Label muted>Ajoutez vos factures à l’étape précédente pour calculer votre objectif.</Label>}
          <Pressable onPress={() => setSavingGoal(!savingGoal)} accessibilityRole="checkbox" accessibilityState={{ checked: savingGoal }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
            <Ionicons name={savingGoal ? 'checkbox' : 'square-outline'} size={26} color={C.marine} />
            <Text style={{ fontSize: 17, color: C.texte, flex: 1 }}>Oui, je veux me constituer ce coussin</Text>
          </Pressable>
          <Label muted>Vous pourrez tout modifier plus tard dans l’onglet Plus.</Label>
        </>
      ) : null}

      {w.error ? <Status tone="risque">{w.error}</Status> : null}
      <Button label={step < STEPS.length - 1 ? 'Continuer' : 'C’est parti !'} disabled={w.busy} onPress={next} />
      {step > 0 ? <Button variant="secondaire" label="Retour" onPress={() => setStep(step - 1)} /> : null}
    </Screen>
  );
}
