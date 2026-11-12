# Mes Finances — consignes du dépôt

Application Android de budget personnel en français pour la Côte d'Ivoire (FCFA XOF, dates civiles d'Abidjan). Son but : décider **avant** de dépenser. Spécification complète : `docs/Prompt_Claude_Mes_Finances.md` et `docs/Mes_Finances_Cahier_des_charges.docx`.

## Périmètre V1
Android, connexion Internet requise, compte personnel (Supabase Auth), saisie manuelle (espèces, Wave, Orange Money, banque). Quatre onglets : Aujourd'hui, Calendrier, Dettes, Épargne. Depuis Aujourd'hui : Tester un achat, Ajouter, Mon budget. Un parcours de découverte utilise des données fictives en mémoire (`DemoRepository`).
Au backlog, hors V1 : synchronisation multiappareil, budgets partagés, import automatique des transactions.
Ajouts demandés par l'utilisatrice ou l'utilisateur (hors cahier) : épargne recommandée selon le revenu et les objectifs (fonds d'urgence ajouté par défaut), suivi des petites rentrées ou « petites coupures » avec rythme de dépense et budget du jour, simulateur de scénarios sur plusieurs mois.

## Structure
- `src/domain/` : moteur pur, sans React, réseau ni horloge. Contient `cycle` (bornes, plafonds, bilan), `forecast`/`allPlanned` (60 jours, vues standard et prudente ; inclut dettes datées et versements d'épargne prévus), `simulatePurchase`, `recurrence`, `dettes`, `objectifs` (échéancier), `revenus` (statistiques de l'historique), `adviseSavings`, `spendingPace`, `simulateScenario` et `reference-abidjan`.
- `src/data/` : dépôts (`FinanceRepository`, `SupabaseRepository`, `DemoRepository`), contexte React, `useWrite` (clé d'opération stable jusqu'au succès).
- `src/app/` : écrans Expo Router. `src/components/ui.tsx` regroupe les composants accessibles.
- `supabase/migrations/` (schéma, RLS, `record_operation` idempotente) et `supabase/tests/` (pgTAP).
- `.claude/agents/` : les 8 sous-agents.

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

## Sécurité et confidentialité
- Récupération d'accès par code à 6 chiffres saisi dans l'application (`src/app/recuperation.tsx`, modèle `supabase/templates/recuperation.html`) : aucun lien d'URL interceptable.
- Verrou facultatif (`LockGate`) : écran neutre tant que les préférences ne sont pas lues, FLAG_SECURE (pas de capture ni de vignette des récentes) quand le verrou est actif.
- Rappels facultatifs, noms et montants masqués par défaut, canal Android en visibilité privée sur l'écran verrouillé.
- Déconnexion (même forcée par le serveur) et suppression du compte (`delete_my_account`) : session, rappels programmés et préférences de l'appareil effacés.
- Production : URL Supabase en HTTPS obligatoire (`acceptableUrl`), confirmer l'e-mail à l'inscription, mot de passe de 8 caractères minimum, modèle d'e-mail de récupération à reporter sur le projet hébergé.
- Intégrité dans un compte : versements, règlements et corrections uniquement depuis/vers un portefeuille du quotidien ; poche d'objectif = portefeuille d'épargne, figée après un versement ; une occurrence réglée doit être une vraie date de la règle.

## Identité visuelle
Couleurs tirées de l'icône et du logo (`C` dans `src/components/ui.tsx`) : marine `#1E183B` (boutons principaux, en-têtes, barre d'onglets, carte `Hero`), lavande `#D9D1FB` (boutons secondaires, bordures), menthe `#8EE3C8` (repère, indicateur d'onglet, progression ; `#12704F` pour du texte sur fond clair). Rouge et ambre réservés aux alertes, toujours avec icône et libellé.

## Commandes (vérifiées)
```
npm test                      # moteur (Jest + jest-expo)
npm run test:integration      # parcours contre Supabase local ; récupération d'accès si SUPABASE_TEST_SECRET_KEY est défini (clé secrète LOCALE, `npx supabase status`)
npm run typecheck && npx expo lint && npx expo-doctor
npx supabase start | test db | db lint --fail-on error
npx supabase gen types typescript --local --schema public > src/types/database.types.ts
npx expo export --platform android   # vérifie le bundle
```
