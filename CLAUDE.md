# Mes Finances — consignes du dépôt

Application Android de budget personnel en français pour la Côte d'Ivoire (FCFA XOF, dates civiles d'Abidjan). Son but : décider **avant** de dépenser. Spécification complète : `docs/Prompt_Claude_Mes_Finances.md` et `docs/Mes_Finances_Cahier_des_charges.docx`.

## Périmètre V1
Android, connexion Internet requise, compte personnel (Supabase Auth), saisie manuelle (espèces, Wave, Orange Money, banque). Quatre onglets : Aujourd'hui, Calendrier, Dettes, Épargne. Depuis Aujourd'hui : Tester un achat, Ajouter, Mon budget. Un parcours de découverte utilise des données fictives en mémoire (`DemoRepository`).
Au backlog, hors V1 : synchronisation multiappareil, budgets partagés, import automatique des transactions.
Ajouts demandés par l'utilisatrice ou l'utilisateur (hors cahier) : épargne recommandée selon le revenu et les objectifs (fonds d'urgence ajouté par défaut), suivi des petites rentrées ou « petites coupures » avec rythme de dépense et budget du jour, simulateur de scénarios sur plusieurs mois.

## Structure
- `src/domain/` : moteur pur, sans React, réseau ni horloge. Agenda arrêté à la fin du mois (`monthEndOutlook` : solde du dernier jour, sorties du début du mois suivant avant la paie, reste réel ; aussi retenues par `monthPlan`). Contient `cycle` (bornes, plafonds, bilan), `forecast`/`allPlanned` (60 jours, vues standard et prudente ; inclut dettes datées et versements d'épargne prévus), `simulatePurchase`, `recurrence`, `dettes`, `objectifs` (échéancier), `revenus` (statistiques de l'historique), `adviseSavings`, `spendingPace`, `simulateScenario` et `reference-abidjan`.
- `src/data/` : dépôts (`FinanceRepository`, `SupabaseRepository`, `DemoRepository`), contexte React, `useWrite` (clé d'opération stable jusqu'au succès).
- `src/app/` : écrans Expo Router. `src/components/ui.tsx` regroupe les composants accessibles.
- `supabase/migrations/` (schéma, RLS, `record_operation` idempotente) et `supabase/tests/` (pgTAP).
- `.claude/agents/` : les 8 sous-agents du projet. `plugins/kit-dev/` (marketplace `kit-udje`, activé dans `.claude/settings.json`) : relecteurs `relecteur-securite`, `relecteur-base-donnees`, `relecteur-react`, `relecteur-typescript` et compétences `react-native-expo`, `postgres-supabase`, `tests-tdd`, `revue-securite`, adaptés d’'ECC (MIT) et réutilisables dans les autres projets. Les consignes de ce fichier priment sur le kit (ex. montants en francs entiers).

## Invariants financiers
- Montants en francs entiers, dates `YYYY-MM-DD`. Une rentrée future ne modifie jamais le solde réel.
- Le même jour, les sorties passent avant les rentrées, sauf `fundedByIncomeId` en vue standard. Une rentrée incertaine est exclue de la vue standard ; la vue prudente exclut toutes les rentrées attendues.
- Une sortie échue non réglée est ramenée à aujourd'hui. Une rentrée en retard sort de la projection.
- Une simulation ne crée aucune opération. Un achat abandonné n'est pas de l'épargne.
- Idempotence : `unique (user_id, client_key)`. Le client garde la même clé pour tous les réessais.
- Les références sont contrôlées par des clés étrangères composites `(user_id, id)`.
- Dette : un remboursement = une opération + un règlement (`record_debt_payment`) ; un paiement supérieur au reste est refusé ; l'annulation supprime l'opération et recalcule. Réglée ≠ annulée ≠ remise. Une créance est incertaine par défaut.
- Épargne : versement et retrait = transfert lié à l'objectif (`record_goal_movement`) ; le retrait ne peut dépasser l'épargne. L'échéancier répartit le reste sur les dates disponibles, arrondi au franc supérieur.
- Remboursements de dettes et versements d'épargne ne comptent pas comme dépenses du quotidien ; les frais de transfert, si.
- Cycle : `currentCycle(snapshot)` (mensuel à jour choisi ou dates libres) ; ne jamais coder le mois civil en dur dans les écrans.
- Les opérations ne s'écrivent que par les fonctions serveur (insert/update/delete directs révoqués) : `record_operation`, `update_operation`, `delete_operation`, `record_debt_payment`, `cancel_debt_payment`, `record_goal_movement`. Statut de dette « ouverte »/« reglee » recalculé par déclencheur.
- Un achat abandonné reste une intention `abandonne` : jamais d'épargne automatique.
- Dépenses mensuelles (`recurring_rules`) : occurrences calculées par `recurringToPlanned` (31 jours en arrière pour garder visible une occurrence échue non payée). Une occurrence se règle une seule fois (`settle_occurrence`, unique `(recurring_rule_id, recurring_original)`). « Ce mois-ci » = `recurring_overrides` ; « les suivantes » = `split_recurring_rule`.

## Crédits
- Moteur `src/domain/credit.ts` : tableau d'amortissement (mensualités constantes arrondies au franc supérieur, ou capital constant ; le capital remboursé égale exactement le montant emprunté), coût total, TEG approché (taux proportionnel), plafond de l'usure UMOA depuis le 1er juin 2026 (14 % banques, 24 % microfinance et autres), repère de capacité d'un tiers du revenu principal (usage bancaire, pas une règle légale), remboursement anticipé (finir plus tôt ou baisser la mensualité, indemnité, comparaison avec l'épargne à 3,5 %), stratégies avalanche et boule de neige.
- Serveur : table `loans` (conditions figées après une échéance payée), `record_loan_operation` (0 = déblocage net des frais, n = échéance n unique, null = remboursement anticipé).
- Les opérations de crédit ne sont ni des revenus ni des dépenses du quotidien ; les échéances non payées entrent dans la prévision.

## Analyste et banquier personnel
- `src/domain/analyse.ts` : patrimoine net, historique mensuel, tendances par catégorie comparées **à la même date** des mois précédents, dépenses inhabituelles (> 2,5 × la médiane de la catégorie), ratios, score de santé sur 100 (épargne, endettement, fonds d'urgence, charges fixes, prévisibilité des rentrées ; 20 points chacun).
- `src/domain/conseiller.ts` : recommandations chiffrées, priorité d'un banquier prudent : payer ce qui est dû → fonds d'urgence → dettes chères → maîtrise des dépenses → placements (jamais de placement conseillé tant qu'un point urgent existe).
- `src/domain/placements.ts` : livret (≈ 3,5 %), DAT (≈ 5 %), titres publics ivoiriens (≈ 6,6 % à 3 ans) ; repères indicatifs datés et sourcés, information pédagogique.
- Écran `src/app/analyste.tsx`, carte « Mon banquier » sur Aujourd'hui.

## Sécurité et confidentialité
- Récupération d'accès par code à 6 chiffres saisi dans l'application (`src/app/recuperation.tsx`, modèle `supabase/templates/recuperation.html`) : aucun lien d'URL interceptable.
- Verrou facultatif (`LockGate`) : écran neutre tant que les préférences ne sont pas lues, FLAG_SECURE (pas de capture ni de vignette des récentes) quand le verrou est actif.
- Rappels facultatifs, noms et montants masqués par défaut, canal Android en visibilité privée sur l'écran verrouillé.
- Déconnexion (même forcée par le serveur) et suppression du compte (`delete_my_account`) : session, rappels programmés et préférences de l'appareil effacés.
- Production : URL Supabase en HTTPS obligatoire (`acceptableUrl`), confirmer l'e-mail à l'inscription, mot de passe de 8 caractères minimum, modèle d'e-mail de récupération à reporter sur le projet hébergé.
- Intégrité dans un compte : versements, règlements et corrections uniquement depuis/vers un portefeuille du quotidien ; poche d'objectif = portefeuille d'épargne, figée après un versement ; une occurrence réglée doit être une vraie date de la règle.

## Projet Supabase en ligne
- Projet `ldfurhmdxvevqwadgfzs` (« Mes Finances », eu-west-1), URL `https://ldfurhmdxvevqwadgfzs.supabase.co`. Migrations jusqu’à `20261120000000_annuler_recu` appliquées et inscrites dans `supabase_migrations.schema_migrations` ; tests pgTAP rejoués sur le projet (transactions annulées).
- Auth en ligne : mot de passe 8 caractères, confirmation de l'e-mail active, codes à 6 chiffres.
- E-mails : SMTP Brevo (`smtp-relay.brevo.com:587`, expéditeur « Mes Finances »), modèles `supabase/templates/confirmation.html` et `recuperation.html` appliqués (code à 6 chiffres), 30 e-mails/heure. Envoi réel vérifié. La clé SMTP ne se trouve que dans la configuration Supabase.
- `.env.local` (ignoré par Git) contient l'URL et la clé publique ; jamais la clé secrète.
- Ne jamais lancer `npm run test:integration` contre le projet en ligne (création de comptes et envois d'e-mails).

## Identité visuelle et ergonomie
- Style des maquettes validées (`C` dans `src/components/ui.tsx`) : fond lavande très clair, grands titres dans l'écran (onglets sans en-tête), cartes teintées (`SummaryCard` lavande pour les montants, menthe pour le positif, ambre/rouge pour les alertes), actions en violet `#5B3FA0`, texte marine `#1E183B` (logo), menthe `#8EE3C8`/`#3FD3A0` pour la progression. Statuts toujours avec icône et libellé.
- Dates affichées en JJ-MM-AAAA (`formatDateFr`), JJ-MM dans les listes (`formatDateCourt`).
- Saisies uniformes (`src/components/inputs.tsx`) : montants au clavier numérique seul (`AmountField`), dates au calendrier (`DateField`), jour du mois en grille (`DayOfMonthField`), choix en ligne « icône · libellé … valeur › » ouvrant une liste (`TileChoice` avec `rowIcon`). Jamais de saisie « AAAA-MM-JJ ».
- Langage de tous les jours, sans jargon (compte, facture du mois, argent attendu, limite de dépenses). Textes longs sur une ligne (`numberOfLines={1}` + `adjustsFontSizeToFit`).
- Accueil : calendrier du mois façon Flo (`src/components/month-calendar.tsx` : bande des jours, grille dépliable, points vert/rouge, jour choisi pour planifier une entrée ou une sortie), « Mon plan du mois » (`monthPlan` : entrées, sorties, ce qui reste, combien/quand/comment épargner, en tenant compte d'un manque avant la paie), « Je peux dépenser aujourd'hui » (`safeToSpend`), anneau du jour du mois, factures proches, dernières opérations (modifiables), conseil du banquier. Outils avancés dans l'onglet « Plus ».
- Aide : visite guidée en 7 cartes à la première ouverture de l’accueil (`VisiteGuidee`, préférence `tourSeen`, « Revoir la visite guidée » dans Plus) et petits « ? » (`Aide`, textes dans `AIDE`) sur les titres d’onglets, les chiffres clés et le plan du mois (`src/components/aide.tsx`).
- Configuration guidée (`src/app/bienvenue.tsx`) au premier lancement d'un compte vide ; toute opération se modifie ou se supprime depuis `src/app/operation.tsx`.

## Commandes (vérifiées)
```
npm test                      # moteur (Jest + jest-expo)
npm run test:integration      # parcours contre Supabase local ; récupération d'accès si SUPABASE_TEST_SECRET_KEY est défini (clé secrète LOCALE, `npx supabase status`)
npm run typecheck && npx expo lint && npx expo-doctor
npx supabase start | test db | db lint --fail-on error
npx supabase gen types typescript --local --schema public > src/types/database.types.ts
npx expo export --platform android   # vérifie le bundle
```
