# THE SHAREL - Architecture Complete des Parametres

## Vue d'ensemble

Architecture en arbre des parametres pour offrir la meilleure experience utilisateur possible.

---

## Structure des Parametres (Arbre)

```
Profil (ProfileScreen)
├── Compte
│   ├── Photo de profil
│   ├── Photo de couverture
│   ├── Nom d'affichage
│   ├── Nom d'utilisateur (@username)
│   ├── Bio
│   ├── Numero de telephone
│   └── ID utilisateur
│
├── General (GeneralSettingsScreen)
│   ├── Apparence
│   │   ├── Theme (Clair / Sombre / Systeme)
│   │   ├── Couleur d'accentuation (12 couleurs)
│   │   ├── Langue (10 langues)
│   │   ├── Contraste eleve (toggle)
│   │   ├── Taille du texte (Petit / Normal / Grand / Tres grand)
│   │   ├── Police de caracteres (Systeme / Custom)
│   │   ├── Animations reduites (toggle)
│   │   └── Mode lecture (toggle)
│   │
│   ├── Icone de l'app
│   │   ├── Icone par defaut
│   │   ├── Icone sombre
│   │   ├── Icone claire
│   │   ├── Icone neon
│   │   └── Icone minimaliste
│   │
│   └── Ecran d'accueil
│       ├── Afficher stockage
│       ├── Afficher transferts recents
│       ├── Nombre d'elements recents (5 / 10 / 15 / 20)
│       └── Vue par defaut (Grille / Liste)
│
├── Preferences (PreferencesSettingsScreen)
│   ├── Transfert
│   │   ├── Auto-accepter des contacts
│   │   ├── Confirmer avant envoi
│   │   ├── Vibration
│   │   ├── Sons de notification
│   │   ├── Afficher progression (Barre / Pourcentage / Les deux)
│   │   ├── Notification persistante pendant transfert
│   │   └── Reprendre auto apres interruption
│   │
│   ├── Reception
│   │   ├── Enregistrer dans la galerie
│   │   ├── Creer des sous-dossiers
│   │   ├── Dossier par defaut
│   │   ├── Organisation (Par date / Par type / Par expediteur)
│   │   ├── Doublons (Renommer / Remplacer / Demander)
│   │   └── Apercu automatique
│   │
│   ├── Sharel Cloud (250 GB)
│   │   ├── Auto-sauvegarde TGBOX
│   │   ├── Gerer les dossiers Cloud
│   │   ├── Sync Wi-Fi uniquement
│   │   ├── Upload auto des photos
│   │   ├── Upload auto des videos
│   │   ├── Qualite d'upload (Original / Haute / Moyenne)
│   │   └── Limite de stockage Cloud
│   │
│   ├── Connexion
│   │   ├── Nom de l'appareil
│   │   ├── Visibilite de l'appareil (Tous / Contacts / Personne)
│   │   ├── Wi-Fi Direct
│   │   ├── Hotspot automatique
│   │   ├── Bluetooth Low Energy
│   │   ├── NFC pour connexion rapide
│   │   └── Portee de decouverte (Proche / Moyen / Loin)
│   │
│   └── Qualite & Performance
│       ├── Compresser les images
│       ├── Compresser les videos
│       ├── Qualite de compression (Basse / Moyenne / Haute)
│       ├── Vitesse maximale (Illimitee / Limitee)
│       ├── Utiliser GPU pour encodage
│       └── Mode economie batterie
│
├── Confidentialite et Securite (PrivacySettingsScreen) [NOUVEAU]
│   ├── Confidentialite
│   │   ├── Photo de profil visible par (Tous / Contacts / Personne)
│   │   ├── Statut en ligne visible par (Tous / Contacts / Personne)
│   │   ├── Derniere connexion visible
│   │   ├── Historique de transferts (Garder / Effacer a la fermeture)
│   │   └── Bloquer appareils
│   │
│   ├── Securite
│   │   ├── Verrouillage de l'app
│   │   │   ├── Activer verrouillage
│   │   │   ├── Type (Code PIN / Mot de passe / Biometrique)
│   │   │   ├── Delai de verrouillage (Immediatement / 1min / 5min / 30min)
│   │   │   └── Verrouiller certains dossiers
│   │   │
│   │   ├── Chiffrement
│   │   │   ├── Chiffrer les transferts
│   │   │   ├── Niveau de chiffrement (Standard / Eleve)
│   │   │   └── Cle de chiffrement personnalisee
│   │   │
│   │   └── Sessions actives
│   │       ├── Voir appareils connectes
│   │       └── Deconnecter tous les appareils
│   │
│   └── Donnees
│       ├── Exporter mes donnees
│       ├── Supprimer mon compte
│       └── Mode incognito (ne pas sauvegarder l'historique)
│
├── Notifications et Sons (NotificationsSettingsScreen) [NOUVEAU]
│   ├── Notifications
│   │   ├── Activer notifications
│   │   ├── Transfert recu
│   │   ├── Transfert termine
│   │   ├── Nouvel appareil detecte
│   │   ├── Demande de connexion
│   │   ├── Erreurs de transfert
│   │   ├── Mises a jour de l'app
│   │   └── Notifications silencieuses (heure de debut / fin)
│   │
│   ├── Sons
│   │   ├── Son de notification
│   │   │   ├── Defaut
│   │   │   ├── Bulle
│   │   │   ├── Ding
│   │   │   ├── Pop
│   │   │   └── Personnalise
│   │   │
│   │   ├── Son de transfert termine
│   │   ├── Son d'erreur
│   │   └── Volume des sons (slider)
│   │
│   └── Vibrations
│       ├── Activer vibrations
│       ├── Pattern de vibration (Court / Moyen / Long)
│       ├── Vibrer pour les notifications
│       └── Vibrer pour le tactile
│
├── Gestes et Raccourcis (GesturesSettingsScreen) [NOUVEAU]
│   ├── Gestes tactiles
│   │   ├── Double tap pour pause/reprendre transfert
│   │   ├── Swipe gauche pour supprimer
│   │   ├── Swipe droite pour partager
│   │   ├── Appui long pour multi-selection
│   │   ├── Pincer pour zoomer (apercu)
│   │   └── Glisser pour reordonner
│   │
│   ├── Secouer le telephone (Shake)
│   │   ├── Activer shake
│   │   ├── Action au shake
│   │   │   ├── Annuler dernier transfert
│   │   │   ├── Decouvrir appareils
│   │   │   ├── Ouvrir envoi rapide
│   │   │   ├── Generer QR code
│   │   │   ├── Activer mode invisible
│   │   │   └── Rien
│   │   │
│   │   ├── Sensibilite (Faible / Moyenne / Elevee)
│   │   └── Desactiver pendant transfert
│   │
│   ├── Raccourcis rapides
│   │   ├── Bouton flottant (FAB)
│   │   │   ├── Position (Droite / Gauche)
│   │   │   ├── Taille (Petit / Normal / Grand)
│   │   │   └── Action (Envoyer / Menu rapide)
│   │   │
│   │   ├── Raccourcis widget
│   │   │   ├── Envoyer fichier
│   │   │   ├── Recevoir fichier
│   │   │   ├── Historique
│   │   │   └── Scanner QR
│   │   │
│   │   └── Actions rapides (3D Touch / Haptic Touch)
│   │       ├── Nouvel envoi
│   │       ├── Scanner QR
│   │       └── Fichiers recents
│   │
│   └── Navigation par gestes
│       ├── Retour par swipe
│       ├── Fermer modal par swipe bas
│       └── Navigation entre onglets par swipe
│
├── Stockage et Donnees (StorageSettingsScreen) [NOUVEAU]
│   ├── Stockage telephone
│   │   ├── Espace utilise (affichage)
│   │   ├── Espace disponible (affichage)
│   │   ├── Fichiers recus (taille totale)
│   │   ├── Cache de l'app
│   │   └── Nettoyer maintenant
│   │
│   ├── Gestion du cache
│   │   ├── Taille max du cache (100MB / 500MB / 1GB / 2GB)
│   │   ├── Vider le cache automatiquement
│   │   ├── Delai avant nettoyage auto (1 jour / 7 jours / 30 jours)
│   │   └── Vider le cache maintenant
│   │
│   ├── Donnees mobiles
│   │   ├── Autoriser transferts sur donnees mobiles
│   │   ├── Limite mensuelle (illimite / 1GB / 5GB / 10GB)
│   │   ├── Avertissement avant utilisation
│   │   └── Statistiques d'utilisation
│   │
│   └── Fichiers recus
│       ├── Emplacement de sauvegarde
│       ├── Supprimer fichiers anciens
│       ├── Delai avant suppression auto
│       └── Exporter tous les fichiers
│
├── Sharel Cloud (SharelCloudSettingsScreen) [NOUVEAU]
│   ├── Compte Cloud
│   │   ├── Espace utilise / Total (250 GB)
│   │   ├── Gerer l'abonnement
│   │   └── Historique de facturation
│   │
│   ├── Synchronisation
│   │   ├── Dossiers synchronises
│   │   ├── Frequence de sync (Temps reel / Toutes les heures / Quotidien)
│   │   ├── Sync en arriere-plan
│   │   └── Pause sync
│   │
│   ├── Partage Cloud
│   │   ├── Liens de partage actifs
│   │   ├── Expiration des liens (1 jour / 7 jours / 30 jours / Jamais)
│   │   └── Protection par mot de passe
│   │
│   └── Sauvegarde
│       ├── Sauvegarder parametres
│       ├── Restaurer depuis sauvegarde
│       └── Derniere sauvegarde (date)
│
└── A propos (AboutSettingsScreen) [NOUVEAU]
    ├── Informations
    │   ├── Version de l'app
    │   ├── Build number
    │   ├── Derniere mise a jour
    │   └── Changelog
    │
    ├── Aide et Support
    │   ├── Centre d'aide
    │   ├── FAQ
    │   ├── Contacter le support
    │   ├── Signaler un bug
    │   └── Suggerer une fonctionnalite
    │
    ├── Legal
    │   ├── Politique de confidentialite
    │   ├── Conditions d'utilisation
    │   ├── Licences open source
    │   └── Mentions legales
    │
    ├── Social
    │   ├── Suivez-nous sur Twitter
    │   ├── Rejoindre Discord
    │   ├── Page Facebook
    │   └── Partager l'app
    │
    └── Developper
        ├── Mode developpeur (cache)
        ├── Logs de debug
        └── Reinitialiser l'app
```

---

## Nouveaux Ecrans a Creer

### 1. PrivacySettingsScreen
- Gestion complete de la confidentialite
- Options de verrouillage biometrique
- Chiffrement des transferts
- Gestion des sessions

### 2. NotificationsSettingsScreen
- Configuration complete des notifications
- Personnalisation des sons
- Patterns de vibration
- Mode silencieux programme

### 3. GesturesSettingsScreen (PRIORITAIRE)
- Configuration du shake phone
- Gestes tactiles personnalisables
- Raccourcis rapides
- Widget settings

### 4. StorageSettingsScreen
- Vue complete du stockage
- Gestion du cache
- Controle des donnees mobiles
- Nettoyage automatique

### 5. SharelCloudSettingsScreen
- Gestion du compte cloud
- Options de synchronisation
- Partage cloud
- Sauvegarde des parametres

### 6. AboutSettingsScreen
- Informations sur l'app
- Aide et support
- Informations legales
- Liens sociaux

---

## Fonctionnalites Gestes & Shake (Detail)

### Shake Phone Actions
| Action | Description | Icone |
|--------|-------------|-------|
| Annuler transfert | Annule le transfert en cours | x-circle |
| Decouvrir appareils | Lance la recherche d'appareils | search |
| Envoi rapide | Ouvre la selection de fichiers | send |
| Generer QR | Affiche le QR code de l'appareil | grid |
| Mode invisible | Desactive la visibilite | eye-off |
| Rien | Desactive le shake | minus |

### Sensibilite Shake
- **Faible**: Necessite un shake vigoureux
- **Moyenne**: Shake normal (recommande)
- **Elevee**: Leger mouvement suffit

### Gestes Tactiles
| Geste | Zone | Action |
|-------|------|--------|
| Double tap | Transfert en cours | Pause/Reprendre |
| Swipe gauche | Liste fichiers | Supprimer |
| Swipe droite | Liste fichiers | Partager |
| Appui long | Liste fichiers | Multi-selection |
| Pincer | Apercu image | Zoom |
| Glisser | File d'attente | Reordonner |

---

## Options d'Apparence (Detail)

### Themes
- Clair (fond blanc)
- Sombre (fond noir/gris fonce)
- Systeme (suit les reglages iOS/Android)
- AMOLED (noir pur pour ecrans OLED)

### Couleurs d'Accentuation (12)
1. Bleu (par defaut)
2. Violet
3. Rose
4. Rouge
5. Orange
6. Jaune
7. Vert
8. Teal
9. Cyan
10. Indigo
11. Gris
12. Personnalise (color picker)

### Taille du Texte
- Petit (85%)
- Normal (100%)
- Grand (115%)
- Tres grand (130%)

### Options d'Accessibilite
- Contraste eleve
- Animations reduites
- Mode lecture
- Taille d'icones ajustable

---

## Contexte de Persistance

Toutes les preferences doivent etre sauvegardees via `AsyncStorage` avec les cles suivantes:

```typescript
const STORAGE_KEYS = {
  // Apparence
  THEME_MODE: '@appearance_theme',
  ACCENT_COLOR: '@appearance_accent',
  LANGUAGE: '@appearance_language',
  HIGH_CONTRAST: '@appearance_contrast',
  TEXT_SIZE: '@appearance_text_size',
  REDUCED_MOTION: '@appearance_reduced_motion',
  
  // Gestes
  SHAKE_ENABLED: '@gestures_shake_enabled',
  SHAKE_ACTION: '@gestures_shake_action',
  SHAKE_SENSITIVITY: '@gestures_shake_sensitivity',
  DOUBLE_TAP_ACTION: '@gestures_double_tap',
  SWIPE_LEFT_ACTION: '@gestures_swipe_left',
  SWIPE_RIGHT_ACTION: '@gestures_swipe_right',
  
  // Notifications
  NOTIFICATIONS_ENABLED: '@notifications_enabled',
  NOTIFICATION_SOUND: '@notifications_sound',
  VIBRATION_ENABLED: '@notifications_vibration',
  VIBRATION_PATTERN: '@notifications_vibration_pattern',
  QUIET_HOURS_START: '@notifications_quiet_start',
  QUIET_HOURS_END: '@notifications_quiet_end',
  
  // Securite
  APP_LOCK_ENABLED: '@security_lock_enabled',
  APP_LOCK_TYPE: '@security_lock_type',
  APP_LOCK_TIMEOUT: '@security_lock_timeout',
  ENCRYPTION_ENABLED: '@security_encryption',
  
  // Stockage
  CACHE_SIZE_LIMIT: '@storage_cache_limit',
  AUTO_CLEAN_ENABLED: '@storage_auto_clean',
  AUTO_CLEAN_DELAY: '@storage_clean_delay',
  MOBILE_DATA_ALLOWED: '@storage_mobile_data',
  MOBILE_DATA_LIMIT: '@storage_mobile_limit',
  
  // Transfert
  AUTO_ACCEPT: '@transfer_auto_accept',
  CONFIRM_SEND: '@transfer_confirm_send',
  COMPRESSION_ENABLED: '@transfer_compression',
  COMPRESSION_QUALITY: '@transfer_compression_quality',
  
  // Cloud
  CLOUD_SYNC_ENABLED: '@cloud_sync_enabled',
  CLOUD_SYNC_FREQUENCY: '@cloud_sync_frequency',
  CLOUD_WIFI_ONLY: '@cloud_wifi_only',
};
```

---

## Priorite d'Implementation

### Phase 1 (Immediat)
1. GesturesSettingsScreen - Shake + Gestes
2. NotificationsSettingsScreen - Sons + Vibrations
3. Ameliorer GeneralSettingsScreen - Taille texte, animations

### Phase 2 (Court terme)
4. PrivacySettingsScreen - Verrouillage app
5. StorageSettingsScreen - Gestion cache
6. AboutSettingsScreen - Infos + Legal

### Phase 3 (Moyen terme)
7. SharelCloudSettingsScreen - Compte cloud
8. Integration complete des widgets
9. Mode developpeur cache

---

## Navigation

```
ProfileScreen
├── GeneralSettingsScreen
├── PreferencesSettingsScreen
├── PrivacySettingsScreen [NOUVEAU]
├── NotificationsSettingsScreen [NOUVEAU]
├── GesturesSettingsScreen [NOUVEAU]
├── StorageSettingsScreen [NOUVEAU]
├── SharelCloudSettingsScreen [NOUVEAU]
└── AboutSettingsScreen [NOUVEAU]
```

Mise a jour de ProfileStackNavigator.tsx necessaire pour ajouter les nouvelles routes.
