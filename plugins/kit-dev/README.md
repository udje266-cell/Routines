# kit-dev

Relecteurs et méthodes de développement en français, réutilisables dans tous les projets.

| Type | Nom | Rôle |
|---|---|---|
| Agent | `relecteur-securite` | Revue de sécurité (secrets, saisies, droits, mobile, Supabase) |
| Agent | `relecteur-base-donnees` | Revue PostgreSQL / Supabase |
| Agent | `relecteur-react` | Revue React / React Native (hooks, accessibilité, listes) |
| Agent | `relecteur-typescript` | Revue TypeScript (types, asynchrone, erreurs) |
| Compétence | `react-native-expo` | Bonnes pratiques Expo |
| Compétence | `postgres-supabase` | Bonnes pratiques Postgres / Supabase |
| Compétence | `tests-tdd` | Tests d'abord |
| Compétence | `revue-securite` | Liste de contrôle avant livraison |

## Installer pour tous ses projets (une fois par ordinateur)
Dans Claude Code :
```
/plugin marketplace add udje266-cell/Routines
/plugin install kit-dev@kit-udje
```

## Activer dans un dépôt (y compris les sessions Claude Code dans le cloud)
Ajouter à `.claude/settings.json` du dépôt :
```json
{
  "extraKnownMarketplaces": {
    "kit-udje": { "source": { "source": "github", "repo": "udje266-cell/Routines" } }
  },
  "enabledPlugins": { "kit-dev@kit-udje": true }
}
```

Adapté d'extraits d'[Everything Claude Code](https://github.com/affaan-m/ECC) (licence MIT, voir `LICENSE`).
