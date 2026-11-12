# Tester Mes Finances sur un téléphone Android

## Installer l'APK
1. Sur le téléphone, ouvrir le lien de téléchargement de la compilation (page Expo du build).
2. Autoriser l'installation depuis le navigateur si Android le demande (« Sources inconnues »).
3. Ou, depuis un ordinateur avec le débogage USB activé :
   ```bash
   adb devices
   adb install -r ./mes-finances-preview.apk
   ```

## Parcours à vérifier
| Domaine | Étapes | Attendu |
|---|---|---|
| Découverte | « Découvrir avec des données fictives » | Bandeau « données fictives », rien n'est envoyé au serveur |
| Premier parcours | Créer Wave 30 000 F, loyer 25 000 F demain, tester un achat de 8 000 F aujourd'hui | « 3 000 F manquants » le jour du loyer |
| Dépenses du mois | Ajouter → « Dépense chaque mois » (loyer au 31), puis « Payé » | Le 31 tombe au dernier jour des mois courts ; une seule opération même en appuyant deux fois |
| Mode avion | Activer le mode avion puis enregistrer une dépense ; désactiver et réessayer | « Connexion requise », saisie conservée, une seule dépense créée |
| Verrou | Réglages → verrouillage → quitter puis revenir | Empreinte ou code demandé ; aucun montant visible avant ; vignette des récentes masquée ; capture d'écran refusée |
| Rappels | Réglages → rappels « la veille », échéance demain | Notification « Une échéance arrive demain » sans nom ni montant ; contenu masqué sur l'écran verrouillé |
| Accessibilité | Activer TalkBack, puis agrandir le texte au maximum | Chaque bouton est annoncé ; statuts lus avec leur libellé ; aucun texte coupé |
| Déconnexion | Se déconnecter | Retour à l'écran de connexion ; plus aucun rappel programmé |
| Suppression | Réglages → Supprimer mon compte (taper SUPPRIMER) | Compte et données effacés ; reconnexion impossible |

## Limite connue (version de test)
Tant qu'un fournisseur d'e-mails (SMTP) n'est pas configuré sur le projet Supabase, les codes de confirmation d'inscription et de récupération ne sont pas envoyés aux adresses extérieures à l'équipe Supabase.
