---
name: revue-securite
description: Liste de contrôle de sécurité avant livraison - secrets, validation des saisies, injection, authentification et droits (RLS), données sensibles, limites de débit, dépendances ; avec les points propres aux applications mobiles et à Supabase.
---

# Liste de contrôle de sécurité

## 1. Secrets
- [ ] Aucune clé, mot de passe ou jeton dans le code ni l'historique Git (`git log -p | grep -i secret`).
- [ ] Fichiers `.env*` réels ignorés par Git ; seul `.env.example` (valeurs factices) est versionné.
- [ ] Application mobile : uniquement des clés **publiques** (ex. clé « publishable » Supabase) ; jamais de clé `service_role`/secrète.
- [ ] Un secret qui a fui est **changé** (rotation), pas seulement supprimé.

## 2. Saisies
- [ ] Tout ce qui vient de l'extérieur est validé (type, longueur, plage, format) **côté serveur** ; la validation côté client n'est qu'un confort.
- [ ] Paramètres de route et liens profonds validés.
- [ ] Fichiers envoyés : taille, type et extension contrôlés.

## 3. Injection
- [ ] Requêtes SQL paramétrées, jamais concaténées.
- [ ] Pas d'`eval`, pas de commande shell construite avec une saisie.

## 4. Authentification et droits
- [ ] Chaque accès aux données vérifie l'utilisateur côté serveur (RLS activée partout, `(select auth.uid())`).
- [ ] Tester qu'un **autre** utilisateur ne peut ni lire ni modifier.
- [ ] Mots de passe : longueur minimale, confirmation de l'adresse e-mail ; récupération sans lien interceptable si possible (code à usage unique).
- [ ] Jetons dans le stockage sécurisé du téléphone ; déconnexion qui efface session et données locales.

## 5. Affichage
- [ ] Pas de HTML non nettoyé (`dangerouslySetInnerHTML`, WebView) ; liens externes vérifiés (pas de `javascript:`).
- [ ] Web : en-têtes CSP, cookies `HttpOnly; Secure; SameSite`, protection CSRF.

## 6. Abus
- [ ] Limites de débit sur la connexion, l'envoi d'e-mails et les actions coûteuses.
- [ ] Écritures rejouables idempotentes (pas de double débit en cas de réessai).

## 7. Données sensibles
- [ ] Aucun secret ni donnée personnelle dans les journaux.
- [ ] Messages d'erreur génériques pour l'utilisateur, détails seulement côté serveur.
- [ ] Mobile : notifications sans montant ni nom sur l'écran verrouillé par défaut ; capture d'écran bloquée sur les écrans sensibles si demandé.
- [ ] Suppression du compte possible et complète.

## 8. Dépendances
- [ ] `npm audit --audit-level=high` sans alerte élevée non traitée.
- [ ] Fichier de verrouillage versionné ; `npm ci` en intégration continue.
- [ ] Nouvelle dépendance : maintenue, populaire, licence compatible.

## Avant livraison
Tout coché, HTTPS partout, mode debug coupé, sauvegardes de la base actives, et l'agent `relecteur-securite` a rendu « OK ».
