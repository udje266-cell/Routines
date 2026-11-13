---
name: react-native-expo
description: Méthodes React Native / Expo - Expo Router, place de chaque état, données serveur, listes performantes, styles, API natives, stockage sécurisé, accessibilité. À utiliser pour créer ou modifier des écrans, composants, navigation ou couche de données d'une application Expo.
---

# React Native / Expo : bonnes pratiques

Pour le flux Expo géré (Expo Router, EAS, modules `expo-*`) sur la nouvelle architecture. Pas de DOM : pas de `<div>`, pas de barre d'adresse.

## Structure
- Routes dans `app/` (ou `src/app/`) : fichiers **minces** qui lisent et valident les paramètres, puis délèguent à un composant d'écran.
- Logique pure (calculs, règles métier) hors de React, testable sans téléphone.

## Paramètres de route : toujours valider
Liens profonds et routes dynamiques apportent des chaînes **non fiables**.
```tsx
const { id } = useLocalSearchParams<{ id?: string }>();
if (!id || !/^[0-9a-f-]{36}$/.test(id)) return <Redirect href="/" />;
```
(Zod ou équivalent si le projet l'utilise déjà.)

## Où mettre chaque état
| Besoin | Où |
|---|---|
| Données du serveur | Un seul propriétaire (cache type TanStack Query, ou un contexte unique qui recharge) — jamais copiées dans un second store |
| État d'interface partagé | Contexte ou petit store |
| Navigation | Paramètres d'Expo Router |
| Formulaire | `useState` local, ou bibliothèque de formulaires + schéma |
| Jetons, secrets | `expo-secure-store` |
| Préférences non secrètes | `AsyncStorage` / MMKV |
Commencer par `useState` local tant que rien ne doit être partagé.

## Écritures
- Bouton désactivé pendant l'envoi ; clé d'opération stable pour les réessais (idempotence côté serveur).
- Toujours afficher les états **chargement, erreur, vide** — jamais un indicateur seul sans issue.

## Listes
Plus de quelques dizaines d'éléments : `FlatList` (ou `FlashList`) avec `keyExtractor` stable et `renderItem` mémoïsé — jamais `items.map` dans un `ScrollView`.

## Styles
Un seul système (StyleSheet ou NativeWind), une palette centralisée. Éviter de recréer de gros objets de style à chaque rendu sur les écrans chargés.

## API natives
Dans des hooks `use*`, avec nettoyage et suivi de l'état de permission (chargement / refusée / accordée) pour afficher un message utile.
```tsx
useEffect(() => {
  let actif = true;
  (async () => { const r = await charger(); if (actif) setEtat(r); })();
  return () => { actif = false; };
}, []);
```

## Accessibilité et écran
- `accessibilityRole`, `accessibilityLabel`, `accessibilityState` sur tout élément touchable ; zones tactiles ≥ 44 px.
- Zones sûres (`react-native-safe-area-context`), clavier qui ne masque pas les champs, agrandissement de police supporté.
- Une information n'est jamais portée par la couleur seule (icône + texte).

## À éviter
- Jeton dans `AsyncStorage` → `expo-secure-store`.
- Clé secrète dans l'application : tout `EXPO_PUBLIC_*` est public ; les appels privilégiés restent côté serveur.
- Faire confiance au client pour les droits : le serveur (RLS) décide.
- Dépendance native non compatible avec la nouvelle architecture : vérifier avant d'ajouter (`npx expo-doctor`).

## Vérifications
`npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`, `npx expo export --platform android` (le bundle se construit).
