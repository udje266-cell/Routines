# Mes Finances — Prompt pour Claude Code

## Comment l’utiliser

**Si tu as déjà un projet**, ouvre un terminal à sa racine. **Si tu pars de zéro**, lance les commandes suivantes depuis le dossier qui contiendra ton projet.

~~~bash
npx create-expo-app@latest mes-finances --template default
cd mes-finances
~~~

Place ce fichier dans le projet. Tu peux aussi y mettre le cahier des charges Word et les deux visuels de **Mes Finances**. Le prompt contient déjà les règles essentielles.

Pour installer Claude Code, si nécessaire, utilise la commande officielle correspondant à ton système.

~~~bash
# macOS, Linux ou WSL
curl -fsSL https://claude.ai/install.sh | bash
~~~

~~~powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
~~~

Puis lance Claude Code à la racine du projet.

~~~bash
# Crée le dossier avant de lancer la session pour que Claude voie les agents ajoutés ensuite.
mkdir -p .claude/agents
claude --version
claude doctor
claude
~~~

Sous PowerShell, la commande de création du dossier est **New-Item -ItemType Directory -Force .claude/agents**. Une fois Claude Code ouvert, envoie-lui ce message.

> Lis Prompt_Claude_Mes_Finances.md et applique la section « Prompt à donner à Claude ». Commence par inspecter mon projet, configure les sous-agents, puis fais avancer le premier parcours utilisable.

Dans le chat Claude sur le Web, colle le bloc qui suit ou joins le fichier. Demande un plan, les fichiers à créer et les commandes à lancer sur ton ordinateur. Les sous-agents configurés ci-dessous sont destinés à Claude Code. [Documentation Claude Code](https://code.claude.com/docs/en/quickstart) · [Sous-agents](https://code.claude.com/docs/en/sub-agents)

---

## Prompt à donner à Claude

### Ta mission

Tu pilotes la conception et le développement de **Mes Finances**, une application Android de budget personnel en français, pour un usage en Côte d’Ivoire. L’application doit aider l’utilisateur à décider **avant de dépenser**. Le parcours principal est de tester un achat, voir la première échéance qu’il risque de compromettre et choisir de l’enregistrer, de le reporter ou de le mettre en pause.

Inspecte le dépôt, les fichiers projet et le cahier des charges joint si tu peux le lire. En l’absence de fichier lisible, applique les règles ci-dessous. Préserve le travail existant et utilise les conventions du dépôt si elles conviennent. Commence par donner un plan court, les choix qui engagent le projet et les premiers critères de recette. Configure ensuite les agents et avance par tranches testables. Si tu n’as pas accès au dépôt, fournis le plan, les chemins des fichiers à créer et les commandes correspondantes.

### Périmètre de lancement

- Android, interface en français, montants en FCFA BCEAO (XOF), dates civiles d’Abidjan. Accès Internet obligatoire pour consulter le budget, simuler et enregistrer. Compte personnel, données enregistrées sur le serveur, récupération d’accès, verrouillage de l’application et suppression du compte.
- Saisie manuelle des espèces, de Wave, d’Orange Money et de la banque. La synchronisation multiappareil comme fonctionnalité produit, les budgets partagés et l’import automatique des transactions restent des décisions ouvertes. Mets-les au backlog sans les intégrer à la V1.
- Quatre onglets **Aujourd’hui**, **Calendrier**, **Dettes** et **Épargne**. Depuis Aujourd’hui, accès à **Tester un achat**, **Ajouter** et **Mon budget**. Prévois un parcours de découverte avec des données fictives isolées des données personnelles.
- Inspire-toi de Flo pour le jour du cycle et l’action du jour, et de PocketSmith pour le calendrier prévisionnel. Utilise les visuels de Mes Finances s’ils sont fournis. L’icône représente un calendrier dans un portefeuille. Le logo typographique est indépendant, avec un repère vert menthe. Fais des écrans accessibles avec des statuts lisibles par libellé et icône, du texte agrandissable et des libellés TalkBack.

### Règles métier à implémenter

**Budget et cycle.** Permets un cycle mensuel à jour choisi et un mode à dates libres pour les revenus irréguliers. En mois court, ramène un jour mensuel absent au dernier jour du mois. Gère les revenus, dépenses et transferts, l’historique modifiable, les plafonds par catégorie, le budget plaisir et le bilan de cycle. Prévois des dépenses récurrentes et la modification d’une seule occurrence ou des suivantes. La dépense réelle liée à une enveloppe planifiée réduit le montant qui reste à projeter.

**Prévision sur 60 jours.** Calcule les soldes réels et prévisionnels par portefeuille et au total. Le total disponible additionne les portefeuilles du quotidien. Une rentrée attendue et datée figure dans la vue standard, une rentrée incertaine en est écartée et la vue prudente exclut toutes les rentrées encore attendues. Une rentrée future ne modifie jamais le solde réel. Le même jour, applique les sorties avant les rentrées non reçues, sauf liaison explicite à un encaissement dans la vue standard. La vue prudente conserve la sortie. Une sortie échue non réglée reste à couvrir aujourd’hui et une rentrée en retard sort de la projection jusqu’à sa confirmation ou sa replanification. Quand une opération est confirmée, remplace la partie prévue correspondante. Le transfert est une action atomique et seuls ses frais sont une dépense. Sur Aujourd’hui, affiche la marge calculée jusqu’à la prochaine rentrée datée et indique quand cette date manque.

**Tester un achat.** Prends le montant, la catégorie, le portefeuille et une date. Compare le plan actuel et le scénario jusqu’à la fin de la projection. Vérifie le portefeuille, le total, les échéances, l’épargne et le plafond de catégorie. Affiche d’abord le manque et sa première date, puis la dépendance à une rentrée et le dépassement de catégorie. Distingue un déficit déjà prévu de l’écart provoqué par l’achat. Cherche la première autre date compatible dans les 60 jours si elle existe et signale les dettes à payer sans date. La simulation seule ne crée aucune opération. La pause propose le lendemain par défaut, avec rappel facultatif, et l’utilisateur peut replanifier, acheter ou renoncer. Un achat abandonné n’est pas une somme épargnée.

**Dettes.** Sépare **Je dois** de **On me doit**. Gère la personne, le montant initial, le reste, une date éventuelle et les paiements partiels. Une dette à payer datée est une sortie prévue. Une créance est incertaine par défaut. Un remboursement crée ou relie une seule opération, diminue le montant restant et actualise l’échéance. Une modification ou annulation recalcule le tout. Refuse un paiement supérieur au reste. Distingue une dette réglée d’une dette annulée ou remise par accord.

**Épargne.** Gère la cible, la date, la poche et les versements datés. Sépare les montants prévus et réellement transférés. Un versement réel diminue le disponible du quotidien, augmente l’épargne et réduit le versement prévu lié. Un retrait diminue la progression. Propose un échéancier ajusté si la date, la cible ou le montant disponible change.

**Coupure réseau.** Indique que la connexion est requise quand le serveur ne répond pas. Préserve la saisie en cours tant que l’application reste ouverte. Donne une clé stable à chaque intention d’écriture et vérifie son résultat après reconnexion avant de réessayer. Le même envoi ne doit jamais créer deux dépenses ou deux remboursements. Garde les rappels facultatifs et masque les noms et montants dans les notifications par défaut.

### Architecture proposée

Si le dépôt est neuf, pars sur **Expo + React Native + TypeScript + Expo Router**, avec **Supabase Auth et PostgreSQL**. Utilise les versions compatibles avec le SDK choisi et conserve le fichier de verrouillage des dépendances. Prépare un environnement local de test avec des données fictives.

- Sépare les écrans, l’accès aux données et les fonctions métier pures. L’accueil, le calendrier et le simulateur utilisent le même moteur de calcul à partir des données chargées en ligne. Les écritures et les invariants sont validés côté serveur.
- Modélise les portefeuilles, les opérations et leurs mouvements, les échéances, les cycles et budgets, les dettes et règlements, les objectifs et versements, les intentions d’achat et les rappels. Utilise des francs entiers, des dates civiles pour les échéances et des identifiants stables. Une écriture liée à une dette, un transfert ou un objectif doit être atomique. Garantis l’idempotence avec une contrainte côté base par compte et clé d’opération.
- Active et teste les politiques RLS sur les tables personnelles. Vérifie aussi l’autorisation sur les fonctions d’écriture et la propriété de toutes les références liées. Côté mobile, expose uniquement l’URL et la clé publique de Supabase. Garde les secrets privilégiés côté serveur. Protège la session sur l’appareil et efface ses données à la déconnexion. Prévois des échanges chiffrés en environnement hébergé, des sauvegardes chiffrées et un essai de restauration en environnement de test.
- Utilise des données fictives dans les exemples, tests et captures. Demande une décision si un choix change la V1, engage une dépense, modifie un service distant réel ou publie une version. Poursuis les travaux locaux réalisables pendant ce temps.

### Sous-agents à configurer

Crée un fichier Markdown par rôle dans **.claude/agents/**. Utilise exactement le nom de la première colonne pour le fichier et le champ **name**. Le champ **description** indique quand déléguer. Le corps précise les fichiers concernés, les résultats à rendre et les limites de la mission.

~~~yaml
---
name: nom-du-role
description: Mission et conditions de délégation.
model: inherit
tools: Read, Grep, Glob
---
Décris ici le travail à faire, les résultats à produire et les contraintes du projet.
~~~

Pour les agents qui écrivent du code ou exécutent des tests, ajoute **Edit, Write, Bash** aux outils. Pour les revues en lecture, conserve **Read, Grep, Glob**. Les agents de revue rendent leurs constats au coordinateur, qui applique et vérifie les corrections. Si une session ne détecte pas le premier dossier d’agents, relance Claude Code. [Syntaxe et chargement des sous-agents](https://code.claude.com/docs/en/sub-agents)

| Nom du sous-agent | Accès | Mission et résultat attendu |
|---|---|---|
| **produit-ux** | Lecture | Transformer le cahier en parcours, écrans et critères d’acceptation. Détailler l’accueil, le simulateur, la pause et les cas d’erreur. Écrire les libellés en français. |
| **architecture-mobile** | Lecture | Examiner le dépôt et proposer les frontières entre écrans, domaine et serveur. Définir les contrats, le traitement des coupures et le découpage en tranches. |
| **moteur-financier** | Écriture | Implémenter les calculs purs de solde, prévision, simulation et échéancier d’épargne. Tester les dates, les récurrences et les entrées incertaines. |
| **backend-supabase** | Écriture | Créer migrations, données de démonstration, politiques RLS et écritures atomiques. Tester l’isolation des comptes et la répétition d’un envoi. |
| **interface-android** | Écriture | Réaliser la navigation, les écrans, les formulaires et les états de chargement ou coupure. Vérifier l’accessibilité et intégrer les visuels disponibles. |
| **qa-recette** | Écriture des tests | Écrire et exécuter les tests de recette. Reproduire les défauts, rapporter les commandes exécutées et indiquer les cas qui nécessitent un appareil. |
| **securite-confidentialite** | Lecture | Examiner les accès, les clés publiques et privées, les sessions, les notifications et la suppression. Lister les problèmes par gravité et les corrections à vérifier. |
| **livraison-android** | Écriture de la configuration | Préparer la configuration de compilation, le guide de test sur téléphone et la recette de l’APK. Identifier les prérequis de signature et de diffusion. |

Utilise **Explore** si tu dois cartographier un dépôt existant et **Plan** si tu dois préparer une modification structurante. Lance d’abord **produit-ux** et **architecture-mobile** sur des tâches indépendantes. Stabilise les contrats avant de faire travailler **moteur-financier** et **backend-supabase** en parallèle. Confie ensuite les écrans à **interface-android**. Demande des revues ciblées à **qa-recette** et **securite-confidentialite**, puis passe la livraison à **livraison-android**. Fournis à chaque agent les règles et fichiers pertinents. Garde le contrôle des fichiers partagés et vérifie le résultat des délégations avant de l’intégrer.

### Commandes de travail

**Dans Claude Code.** Utilise **/plan** pour préparer une tranche, **/agents** pour l’aide à la configuration des sous-agents, **/permissions** pour vérifier les autorisations, **/status** pour voir la configuration active et **/compact** si la session s’allonge. **/init** peut préparer les consignes d’un dépôt sans **CLAUDE.md**. Utilise **claude --resume** depuis le terminal pour reprendre une session. Inscris dans **CLAUDE.md** le périmètre V1, les invariants financiers, la structure et les commandes réellement utilisées. [Commandes Claude Code](https://code.claude.com/docs/en/commands) · [Référence CLI](https://code.claude.com/docs/en/cli-reference)

**Dépendances et Supabase local.** Vérifie les outils disponibles. Exécute ces blocs depuis la racine, en réutilisant les dépendances et la configuration déjà présentes. Un moteur compatible Docker doit tourner pour la pile locale classique.

~~~bash
git status --short --branch
node --version
npm --version
docker --version

npx expo install @supabase/supabase-js react-native-url-polyfill
npm install --save-dev supabase@3
npx supabase init
npx supabase start
npx supabase status
~~~

Crée **.env.example** avec **EXPO_PUBLIC_SUPABASE_URL** et **EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY** sans valeurs réelles. Renseigne **.env.local** pour le développement et vérifie qu’il est ignoré par Git. Configure l’adaptateur de session adapté à Android et le lien de récupération de compte. Documente l’adresse à utiliser selon que le serveur local est testé depuis un émulateur ou un téléphone. Le client de production utilise une URL HTTPS. [Auth React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) · [Développement local Supabase](https://supabase.com/docs/guides/local-development) · [Clés API](https://supabase.com/docs/guides/getting-started/api-keys)

~~~bash
# Nouvelle migration, uniquement quand un changement de schéma le justifie
npx supabase migration new initial_schema

# Depuis la pile locale Supabase CLI v3
npx supabase migration up
mkdir -p src/types
npx supabase gen types typescript --schema public > src/types/database.types.ts
npx supabase db lint --fail-on error
npx supabase test db
~~~

Adapte le chemin des types au dépôt. **npx supabase db reset** réinitialise la base locale avec la CLI v3. Réserve cette commande à une base de test jetable. [Cibles locales et distantes](https://supabase.com/docs/guides/local-development/local-and-hosted-projects) · [Génération des types](https://supabase.com/docs/guides/api/rest/generating-types) · [Tests SQL](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)

**Tests et exécution Android.** Configure Jest avec **jest-expo** et les scripts s’ils manquent. Lance les tests depuis la racine. Pour une compilation native locale, il faut l’environnement Android installé et un émulateur ou un appareil prêt.

~~~bash
npx expo install jest-expo jest @types/jest @testing-library/react-native --dev
npm pkg set 'scripts.typecheck=tsc --noEmit' 'scripts.test=jest'

npx expo install --check
npx expo-doctor
npx expo lint
npm run typecheck
npm test -- --runInBand
git diff --check

# Démarrage du serveur de développement et ouverture sur Android
npx expo start --android

# Compiler et installer une version de développement locale, si nécessaire
npx expo run:android
~~~

Pour les rappels et le verrouillage, installe les modules Expo retenus au moment de les implémenter.

~~~bash
npx expo install expo-notifications expo-local-authentication
~~~

Vérifie sur une version native les liens d’authentification, le verrouillage et les rappels lorsqu’ils sont intégrés. [Tests Expo](https://docs.expo.dev/develop/unit-testing/) · [Expo CLI](https://docs.expo.dev/more/expo-cli/) · [Liens Android](https://docs.expo.dev/linking/into-your-app/) · [Notifications Expo](https://docs.expo.dev/versions/latest/sdk/notifications/) · [Authentification locale Expo](https://docs.expo.dev/versions/latest/sdk/local-authentication/)

**Options Claude et livraison.** Le plugin Expo officiel est facultatif. Installe-le uniquement si tu veux donner à Claude l’accès à cette documentation et aux outils Expo. Pour une compilation EAS, prépare un profil **preview** qui produit un APK, avec **android.buildType** à **apk**. Les commandes de compilation distante sont à lancer quand le compte et le build sont autorisés.

~~~bash
# Plugin Expo facultatif
claude plugin install expo@claude-plugins-official --scope project

# EAS, uniquement si la compilation distante a été choisie
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
~~~

Après téléchargement de l’APK, place-le dans le dossier courant sous le nom **mes-finances-preview.apk**. Si le débogage USB est activé, vérifie la présence de l’appareil et installe la version de test.

~~~bash
adb devices
adb install -r ./mes-finances-preview.apk
~~~

Dans Claude Code, **/mcp** permet de gérer la connexion Expo du plugin si tu l’utilises. [Plugin Expo pour Claude Code](https://docs.expo.dev/agents/claude/) · [APK Android avec EAS](https://docs.expo.dev/build-reference/apk/) · [Android Debug Bridge](https://developer.android.com/tools/adb)

### Recette à faire passer

| Scénario | Résultat attendu |
|---|---|
| **Achat avant le loyer** | Wave contient **30 000 F** le 12. Loyer **25 000 F** le 13. Achat de **8 000 F** le 12. Le simulateur signale **3 000 F manquants le 13**. |
| **Achat après la rentrée** | Dans le même scénario, ajoute **20 000 F** attendus le 16 et **10 000 F** d’épargne prévue le 17. Si la rentrée arrive, un achat de **8 000 F** le 17 laisse **7 000 F** après le versement d’épargne. Un retard actualise la date proposée ou indique qu’aucune date ne convient. |
| **Deux vues de prévision** | Une créance attendue apparaît dans la vue standard, disparaît de la vue prudente et n’augmente pas le solde réel avant encaissement. |
| **Dette partielle** | Une dette de **20 000 F** remboursée à hauteur de **5 000 F** crée une seule opération et laisse **15 000 F**. Son annulation ramène le reste à **20 000 F**. |
| **Transfert et épargne** | Un transfert entre deux portefeuilles du quotidien conserve le total hors frais. Un versement de **10 000 F** vers l’épargne réduit le disponible quotidien de **10 000 F** et augmente l’épargne d’autant. |
| **Pause** | Une intention en pause ne modifie pas la projection. La reprendre relance la simulation. L’abandonner ne crée aucune épargne. |
| **Récurrence** | Une échéance au 31 tombe au dernier jour d’un mois plus court. Modifier une occurrence laisse les autres aux dates prévues. |
| **Coupure et réessai** | Le mode avion affiche l’état de connexion requise. Une coupure au moment de valider, suivie d’un réessai avec la même clé, produit une seule opération. |
| **Confidentialité** | Avec deux comptes de test, le premier ne peut ni lire ni modifier les données du second. Vérifie la récupération d’accès, la suppression et la restauration sur un environnement de test. |

### Ordre de réalisation et livrables

1. **Cadrage et maquette.** Cartographie du dépôt, parcours principaux, décisions techniques et états d’interface.
2. **Premier parcours de bout en bout.** Compte, portefeuille Wave de test, loyer prévu, écran Aujourd’hui, simulation d’un achat et validation. Vérifie le scénario de **3 000 F manquants** avant d’élargir le périmètre.
3. **Cycle complet.** Calendrier, catégories, pause, dettes, épargne, bilan, rappels et états réseau. Teste chaque tranche avec le moteur, le serveur et l’écran connectés.
4. **Recette Android.** Tests unitaires, SQL et parcours sur appareil. Produis le code, les migrations, un README de démarrage, les huit agents, la liste des commandes exécutées et les résultats de recette. Prépare une version Android installable selon le mode de compilation disponible.

À chaque bilan, indique les fichiers modifiés, les commandes et résultats observés, les décisions prises et les vérifications qui restent à faire. Si tu ne peux pas exécuter un test ou produire l’APK, précise le prérequis et la commande à lancer.
