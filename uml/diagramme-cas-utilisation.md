# Diagrammes de Cas d'Utilisation — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

> **Note** : Mermaid ne supporte pas nativement la notation UML des cas d'utilisation (ellipses, acteurs stick-figure, relations include/extend). Ce document utilise un format tabulaire structuré par module. Les diagrammes graphiques complets sont disponibles dans l'artifact HTML SVG séparé.

---

## Acteurs du système

| Acteur | Abréviation | Rôle dans le PIM |
|--------|-------------|-----------------|
| **Administrateur système** | Admin | Configuration globale, gestion des comptes, audit complet, rollback, export catalogue |
| **Chef de produit** | CdP | Création des offres, assemblage produits/packs, soumission pour validation |
| **Analyste marketing** | AM | Enrichissement des fiches (descriptions, SEO, visuels), dépôt des médias |
| **Chef de service** | CdS | Validation opérationnelle des offres, validation graphique des médias |
| **Chef de département marketing et produits** | CdD | Validation stratégique, publication, suspension, planification, vue KPI globale |
| **Community Manager** | CM | Campagnes de diffusion réseaux sociaux et partenaires, suivi statistiques |
| **Système** | Sys | Transitions automatiques (publication planifiée, expiration), diffusion auto, vérification conformité |

---

## Module 1 — Comptes, Authentification et Habilitations

| # | Cas d'utilisation | Acteur(s) | Description |
|---|-------------------|-----------|-------------|
| 1.1 | Se connecter | Tous | Authentification par email/mot de passe, retour JWT (access + refresh) |
| 1.2 | Se déconnecter | Tous | Invalidation du token côté client |
| 1.3 | Gérer son profil | Tous | Modifier ses informations personnelles et son mot de passe |
| 1.4 | Gérer les comptes utilisateurs | Admin | Créer, désactiver, changer le rôle d'un utilisateur |
| 1.5 | Consulter l'historique complet | Admin | Vue globale de toutes les modifications, avec rollback possible |
| 1.6 | Consulter son historique | CdP, AM, CdS, CdD, CM | Historique de ses propres fiches, lecture seule, sans rollback |
| 1.7 | Auditer les connexions | Admin | Journal des connexions et actions sensibles |
| 1.8 | Configurer les canaux de notification | Admin | Activer/désactiver les types de notification, choisir les canaux |

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
| 5.1 | Déposer un visuel | AM | Upload image, vidéo ou PDF associé à une offre |
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
| 6.1 | Stocker un média | AM, CdP | Upload vers MinIO, association à une fiche produit/offre |
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
