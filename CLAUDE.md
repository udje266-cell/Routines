# Mes Finances — consignes du dépôt

Application Android de budget personnel en français pour la Côte d'Ivoire (FCFA XOF, dates civiles d'Abidjan). Son but : décider **avant** de dépenser. Spécification complète : `docs/Prompt_Claude_Mes_Finances.md` et `docs/Mes_Finances_Cahier_des_charges.docx`.

## Périmètre V1
Android, connexion Internet requise, compte personnel (Supabase Auth), saisie manuelle (espèces, Wave, Orange Money, banque). Quatre onglets : Aujourd'hui, Calendrier, Dettes, Épargne. Depuis Aujourd'hui : Tester un achat, Ajouter, Mon budget. Un parcours de découverte utilise des données fictives en mémoire (`DemoRepository`).
Au backlog, hors V1 : synchronisation multiappareil, budgets partagés, import automatique des transactions.
Ajouts demandés par l'utilisatrice ou l'utilisateur (hors cahier) : épargne recommandée selon le revenu et les objectifs (fonds d'urgence ajouté par défaut), suivi des petites rentrées ou « petites coupures » avec rythme de dépense et budget du jour, simulateur de scénarios sur plusieurs mois.

## Structure
- `src/domain/` : moteur pur, sans React, réseau ni horloge. Contient `forecast` (60 jours, vues standard et prudente), `simulatePurchase`, `recurrence`, `adviseSavings`, `spendingPace`, `simulateScenario` et `reference-abidjan`.
- `src/data/` : dépôts (`FinanceRepository`, `SupabaseRepository`, `DemoRepository`), contexte React et clés d'opération.
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

## Commandes (vérifiées)
```
npm test                      # moteur (Jest + jest-expo)
npm run test:integration      # parcours 1 contre Supabase local
npm run typecheck && npx expo lint && npx expo-doctor
npx supabase start | test db | db lint --fail-on error
npx supabase gen types typescript --local --schema public > src/types/database.types.ts
npx expo export --platform android   # vérifie le bundle
```
