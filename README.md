# Mes Finances

Budget personnel pour Android (Côte d'Ivoire, FCFA). L'application sert à tester un achat avant de le faire, à voir l'échéance qu'il menace, puis à acheter, reporter ou mettre en pause.

## Démarrer
```bash
npm install
cp .env.example .env.local        # renseigner l'URL et la clé publique
npx supabase start                # Docker requis ; affiche l'URL et la PUBLISHABLE_KEY
npx expo start --android
```
Adresse du serveur local :
- depuis l'émulateur Android : `http://10.0.2.2:54321` ;
- depuis un téléphone sur le même Wi-Fi : `http://<IP-de-l-ordinateur>:54321`.

En production, utilise l'URL HTTPS du projet. Sans configuration, le bouton « Découvrir avec des données fictives » fonctionne quand même.

## Tests
`npm test`, `npm run test:integration` (avec Supabase lancé) et `npx supabase test db`.

## APK de test
Le profil EAS `preview` produit un APK : `npx eas-cli@latest build --platform android --profile preview`. Il faut un compte Expo. Pour l'installer : `adb install -r ./mes-finances-preview.apk`.
