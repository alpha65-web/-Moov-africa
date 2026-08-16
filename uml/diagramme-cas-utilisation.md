# Diagrammes de Cas d'Utilisation — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

> **Note** : Mermaid ne supporte pas nativement la notation UML des cas d'utilisation (ellipses, acteurs stick-figure, relations include/extend). Ce document utilise un format tabulaire structuré par module. Les diagrammes graphiques complets sont disponibles dans l'artifact HTML SVG séparé.

---

## Acteurs du système

| Acteur | Abréviation | Rôle dans le PIM |
|--------|-------------|-----------------|
| **Administrateur système** | Admin | Configuration globale, gestion des comptes, audit complet, rollback, export catalogue, gestion des clés cryptographiques, monitoring sécurité, conformité RGPD |
| **Chef de produit** | CdP | Création des offres, assemblage produits/packs, soumission pour validation |
| **Analyste marketing** | AM | Enrichissement des fiches (descriptions, SEO, visuels), dépôt des médias |
| **Chef de service** | CdS | Validation opérationnelle des offres, validation graphique des médias |
| **Chef de département marketing et produits** | CdD | Validation stratégique, publication, suspension, planification, vue KPI globale |
| **Community Manager** | CM | Campagnes de diffusion réseaux sociaux et partenaires, suivi statistiques |
| **Système** | Sys | Transitions automatiques (publication planifiée, expiration), diffusion auto, vérification conformité, scan antivirus, rotation de clés, monitoring certificats, nettoyage des données expirées |

---

## Module 1 — Comptes, Authentification et Habilitations

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 1.1 | Se connecter | Tous | Authentification par email/mot de passe avec fingerprint binding. Retour JWT (access + refresh) avec token versioning. Vérification MFA si activé. |
| 1.2 | Se connecter via Passkey | Tous | Authentification sans mot de passe via WebAuthn/FIDO2 (Passkeys). Vérification du signatureCount contre le clonage. |
| 1.3 | Se déconnecter | Tous | Révocation du refresh token en base (hash SHA-256). Invalidation côté serveur. |
| 1.4 | Gérer son profil | Tous | Modifier ses informations personnelles et son mot de passe (avec validation de la politique de sécurité). |
| 1.5 | Changer son mot de passe | Tous | Validation politique : min 12 caractères, majuscule, minuscule, chiffre, caractère spécial, vérification HIBP (k-anonymity). Incrémentation du tokenVersion (révocation de tous les tokens). |
| 1.6 | Configurer le MFA TOTP | Tous | Génération du secret TOTP (RFC 6238), affichage du QR code, validation par saisie d'un code. Secret chiffré AES-256-GCM en base. |
| 1.7 | Enregistrer une Passkey | Tous | Enregistrement d'une clé WebAuthn/FIDO2 (Yubico webauthn-server-core). Support multi-clés par utilisateur. |
| 1.8 | Désactiver le MFA | Tous | Désactivation du TOTP après vérification d'un code valide. Suppression du secret chiffré. |
| 1.9 | Gérer les comptes utilisateurs | Admin | Créer, désactiver, changer le rôle d'un utilisateur. Forcer le changement de mot de passe. |
| 1.10 | Consulter l'historique complet | Admin | Vue globale de toutes les modifications, avec rollback possible |
| 1.11 | Consulter son historique | CdP, AM, CdS, CdD, CM | Historique de ses propres fiches, lecture seule, sans rollback |
| 1.12 | Auditer les connexions | Admin | Journal des connexions et actions sensibles (login, MFA, changement de mot de passe, révocation) |
| 1.13 | Configurer les canaux de notification | Admin | Activer/désactiver les types de notification, choisir les canaux |

**Relations include/extend :**
- 1.1 *include* vérification MFA (si totpEnabled = true)
- 1.5 *include* validation politique de mot de passe
- 1.5 *include* vérification HIBP (k-anonymity SHA-1)
- 1.6 *extend* 1.1 (MFA optionnel, obligatoire pour ADMIN_SYSTEME)

---

## Module 2 — Catalogue (Produits, Services, Packs)

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 2.1 | Créer un produit | CdP | Saisie des caractéristiques techniques, catégorie, prix. Détection automatique de doublons. |
| 2.2 | Modifier un produit | CdP | Mise à jour des informations. Versioning optimiste. |
| 2.3 | Consulter le catalogue | CdP, AM, CdS, CdD | Recherche et consultation des produits, services, packs |
| 2.4 | Archiver un produit | CdP | Suppression logique (status = ARCHIVED) |
| 2.5 | Créer un service | CdP | Type de service, cycle de facturation, caractéristiques |
| 2.6 | Créer un pack | CdP | Assemblage de produits et/ou services, prix pack, réduction |
| 2.7 | Gérer les catégories | CdP, Admin | Arborescence hiérarchique de catégories |
| 2.8 | Résoudre un doublon | CdP | Marquer un doublon détecté comme faux positif ou fusionner |
| 2.9 | Recherche sémantique | CdP, AM | Recherche dans le catalogue par mots-clés et similarité |

---

## Module 3 — Règles et Dépendances

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 3.1 | Définir une règle métier | CdP | Compatibilité, incompatibilité, composition obligatoire, pack-only |
| 3.2 | Modifier / désactiver une règle | CdP | Activation/désactivation sans suppression |
| 3.3 | Vérifier les règles d'une offre | Sys | Vérification automatique à l'assemblage, blocage ou avertissement |
| 3.4 | Vérifier la cohérence globale | Admin | Détection de règles contradictoires dans l'ensemble du catalogue |
| 3.5 | Consulter les règles d'une offre | CdP, CdS | Voir quelles règles s'appliquent à une offre donnée |

---

## Module 4 — Cycle de Vie des Offres

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 4.1 | Créer une offre | CdP | Assemblage à partir de produits/packs, tarification, segmentation client |
| 4.2 | Enrichir une offre | AM | Descriptions marketing, SEO, mentions légales. Même fiche, pas de duplication. |
| 4.3 | Soumettre pour validation | CdP | Passage EN_ENRICHISSEMENT -> EN_VALIDATION (pré-requis : qualityScore, médias conformes) |
| 4.4 | Valider (opérationnel) | CdS | Validation ou rejet avec commentaire |
| 4.5 | Valider (stratégique) | CdD | Publication, planification, ou annulation (consigne direction) |
| 4.6 | Publier une offre | CdD | Publication immédiate, déclenche la diffusion automatique |
| 4.7 | Planifier une publication | CdD | Publication différée à une date/heure future |
| 4.8 | Suspendre une offre | CdD | Retrait temporaire de la diffusion |
| 4.9 | Reprendre une offre | CdD | Remise en ligne après suspension |
| 4.10 | Retirer / archiver | CdD, Admin | Passage en obsolète, retirée, puis archivée |
| 4.11 | Consulter l'historique diff | CdP, CdS, CdD | Historique visuel des modifications (avant/après) |
| 4.12 | Rollback une version | Admin | Restauration d'une version antérieure d'une offre |

**Relations include/extend :**
- 4.1 *include* 3.3 (vérification des règles à la création)
- 4.3 *include* vérification qualityScore
- 4.3 *include* vérification conformité médias
- 4.6 *extend* 4.5 (publication = issue de la validation stratégique)

---

## Module 5 — Validation Graphique (circuit dédié)

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 5.1 | Déposer un visuel | AM | Upload image, vidéo ou PDF associé à une offre. Scan antivirus ClamAV automatique avant stockage. |
| 5.2 | Vérifier la conformité | Sys | Contrôle automatique : résolution, format, signalement risque droits d'auteur |
| 5.3 | Annoter un média | CdS | Annotation détaillée selon le type de média |
| 5.4 | Comparer des versions | CdS | Comparaison côte à côte de deux versions d'un même visuel |
| 5.5 | Valider / rejeter un média | CdS | Circuit indépendant de la validation métier |
| 5.6 | Corriger et redéposer | AM | Nouveau upload après rejet, même circuit de vérification |

**Relation avec le module 4 :** 5.5 est un pré-requis de 4.3 — l'offre ne peut pas être soumise en validation métier tant qu'un média est en statut REJECTED.

---

## Module 6 — Gestion des Actifs Numériques (DAM)

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 6.1 | Stocker un média | AM, CdP | Upload vers MinIO (S3), scan antivirus ClamAV, association à une fiche produit/offre |
| 6.2 | Consulter la bibliothèque | AM, CdP | Bibliothèque de médias réutilisables |
| 6.3 | Associer la charte graphique | Admin | Mise à disposition des logos Moov Africa (fond bleu / fond blanc) |

---

## Module 7 — IA et Génération de Contenu

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 7.1 | Auto-tagger un produit | Sys, CdP | Extraction automatique de données depuis fiches techniques à la création |
| 7.2 | Générer des descriptions marketing | AM | Génération SEO (courte + longue) à partir des caractéristiques techniques |
| 7.3 | Lancer un test A/B | AM | Comparaison de deux variantes de contenu marketing sur une métrique |
| 7.4 | Utiliser l'assistant conversationnel | Tous | Assistant IA interne pour aide contextuelle |

---

## Module 8 — Notifications

| # | Cas d'utilisation | Acteur(s) | Déclencheur |
|---|-------------------|-----------|-------------|
| 8.1 | Notifier l'analyste marketing | Sys -> AM | Offre créée, en attente d'enrichissement |
| 8.2 | Notifier le chef de service | Sys -> CdS | Offre soumise pour validation |
| 8.3 | Notifier le chef de département | Sys -> CdD | Offre validée par le CdS, validation stratégique requise |
| 8.4 | Notifier le chef de produit | Sys -> CdP | Offre rejetée (avec motif) ou publiée |
| 8.5 | Notifier le community manager | Sys -> CM | Offre publiée, campagne possible |
| 8.6 | Notifier l'expiration | Sys -> CdP, CdD | Offre bientôt expirée (délai configurable) |

---

## Module 9 — Analytique et KPIs

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 9.1 | Suivre le Time To Market | CdD | Temps entre création et mise en ligne, goulots d'étranglement |
| 9.2 | Suivre la productivité des équipes | CdD | Par étape du workflow, vue globale |
| 9.3 | Consulter son temps de traitement | AM | Visible par l'AM pour lui-même uniquement, pas de vue d'équipe |
| 9.4 | Consulter le taux de complétude | CdD | Pourcentage du catalogue avec fiches complètes |
| 9.5 | Rapprochement CRM | CdD | Croisement ventes/offres |
| 9.6 | Configurer les indicateurs | Admin | Activer/désactiver, définir des seuils d'alerte |

---

## Module 10 — Diffusion et Intégration Multicanale

### Bloc 1 — Diffusion automatique (sans intervention humaine)

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 10.1 | Diffuser vers le CRM | Sys | Export automatique de la fiche complète dès publication |
| 10.2 | Diffuser vers le centre d'appel | Sys | Idem, en temps réel |
| 10.3 | Diffuser vers le site web / e-boutique | Sys | Idem, en temps réel |
| 10.4 | Resynchroniser après échec | Sys | Retry automatique avec backoff exponentiel |
| 10.5 | Exporter le catalogue | Admin | Export complet, action autonome sans lien avec la diffusion auto |

### Bloc 2 — Diffusion manuelle (Community Manager)

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 10.6 | Préparer une campagne | CM | Choix de l'offre, des réseaux ciblés, message adapté par canal |
| 10.7 | Programmer une diffusion | CM | Diffusion différée à une date/heure future |
| 10.8 | Diffuser vers les réseaux sociaux | CM | Facebook, Instagram, LinkedIn |
| 10.9 | Diffuser vers les sites partenaires | CM | Sites partenaires de Moov |
| 10.10 | Suivre les statistiques | CM | Vues, clics, engagement par canal |

---

## Module 11 — Administration de la Sécurité

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 11.1 | Gérer les clés de session | Admin | Rotation des clés JWT de session (cycle 90 jours). Révocation d'urgence de toutes les sessions. |
| 11.2 | Acquitter la rotation de la clé maître | Admin | Acquittement de la rotation de la clé maître Vault (cycle 365 jours). |
| 11.3 | Consulter le statut des clés | Admin | Tableau de bord : dernière rotation, conformité des cycles, alertes de retard. |
| 11.4 | Révoquer toutes les sessions (urgence) | Admin | Révocation immédiate de tous les refresh tokens + incrémentation de tous les tokenVersion. Utilisé en cas de compromission. |
| 11.5 | Surveiller les certificats TLS | Sys | Vérification quotidienne (6h00) de l'expiration des certificats TLS des endpoints configurés. Alertes WARNING (30 jours) et CRITICAL (7 jours). |
| 11.6 | Vérifier la conformité rotation | Sys | Vérification hebdomadaire (lundi 2h00) que la rotation des clés respecte les cycles configurés. Alerte si en retard. |

**Relations include/extend :**
- 11.1 *include* révocation des refresh tokens existants
- 11.4 *include* incrémentation de tous les tokenVersion

---

## Module 12 — Conformité RGPD et Protection des Données

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 12.1 | Exporter les données personnelles | Admin, Utilisateur | Export au format JSON de toutes les données personnelles d'un utilisateur (droit d'accès RGPD). Inclut : profil, audit logs, notifications. |
| 12.2 | Anonymiser un compte | Admin | Anonymisation irréversible des PII (email, prénom, nom) d'un utilisateur. Le compte passe en status ANONYMIZED. Les données métier (offres, audits) sont conservées sans lien nominatif. |
| 12.3 | Nettoyer les données expirées | Sys | Suppression automatique (scheduler quotidien) des refresh tokens expirés, clés d'idempotence expirées, et anciennes entrées d'audit selon la politique de rétention. |
| 12.4 | Filtrer les données sensibles (DLP) | Sys | Filtre DLP sur les réponses HTTP : détection et blocage des fuites de données sensibles (numéros de carte, SSN, emails en masse). Limite de taille des réponses (5 Mo). |
| 12.5 | Masquer les PII dans les logs | Sys | Masquage automatique des données personnelles identifiables (emails, téléphones, cartes de crédit) dans les logs applicatifs via PiiMaskConverter (Logback). |
