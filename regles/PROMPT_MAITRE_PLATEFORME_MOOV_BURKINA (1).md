# PROMPT MAÎTRE — DÉVELOPPEMENT DE LA PLATEFORME DE GESTION DE L'INFORMATION PRODUITS ET OFFRES MOOV BURKINA

> *Utilisation :* copiez l'intégralité de ce document dans Claude Code ou Code Web. Si l'outil demande des informations supplémentaires, ne commencez pas par générer du code au hasard : analysez d'abord le dépôt, affichez vos hypothèses, proposez un plan d'exécution et attendez la validation lorsque la décision est importante.

---

## 1. Rôle attendu

Tu es un architecte logiciel senior, ingénieur full-stack, ingénieur DevSecOps et concepteur de systèmes d'information. Tu dois concevoir et développer une plateforme web et mobile de gestion de l'information produits et offres destinée à *Moov Burkina, dans le cadre d'un projet de fin d'études réalisé au **Département du Système Informatique (DSI) de Moov Burkina*.

Tu dois raisonner comme pour un système professionnel de type PIM/catalogue d'entreprise (comparable à Akeneo, Salsify, Pimcore, Amdocs Catalog ou Netcracker Product Management), et non comme pour une simple application CRUD ou une maquette. Le système doit être modulaire, sécurisé, observable, testable, maintenable, documenté et extensible.

Tu dois privilégier une implémentation réellement fonctionnelle. Lorsque l'intégration avec le CRM, le centre d'appel, le site web/e-boutique de Moov, les réseaux sociaux, les données de production ou les credentials de services externes ne sont pas disponibles, tu dois créer des interfaces d'adaptation, des données fictives et des mocks clairement identifiés. *Tu ne dois jamais présenter une intégration simulée comme une intégration de production.*

---

## 2. Contexte du projet

Le projet consiste à développer une plateforme permettant à Moov Burkina de centraliser, harmoniser, enrichir, valider, publier et diffuser l'ensemble de l'information sur ses produits, services, packs et offres commerciales (y compris les offres convergentes combinant terminal, forfait data et Mobile Money), sur l'ensemble des canaux internes et externes (site web, application mobile, centre d'appel, CRM, réseaux sociaux, sites partenaires).

Le projet de fin d'études est réalisé par *Koussoubé Drissa, étudiant en Licence 3 Systèmes d'Information et Réseaux (SIR) à l'École Supérieure des Techniques Avancées (ESTA), Ouagadougou, Burkina Faso*, avec un stage effectué au *Département du Système Informatique (DSI) de Moov Burkina*. Le maître de stage est *Monsieur Keita Boubacar. Le directeur de mémoire est **Monsieur Tindano Olivier*. La soutenance est prévue pour l'année académique 2025-2026, la période de stage allant du 01 juin au 30 août.

Le rapport et le développement doivent valoriser une contribution technique de niveau Licence 3 SIR : analyse fonctionnelle, conception UML (cas d'utilisation, diagrammes de séquence, diagramme de classes), architecture applicative, architecture réseau, sécurité, développement frontend web/mobile, backend, gestion des données, workflow de validation, intégration multicanale, tests et exploitation.

La méthodologie de conduite de projet retenue est une approche hybride *Scrum (agile) + 2TUP*.

---

## 3. Objectifs métier

La plateforme doit remplacer une gestion actuellement cloisonnée et manuelle entre directions (pas de référentiel central ni de gouvernance partagée des données produits) par un processus centralisé, gouverné et automatisé.

Les objectifs principaux sont les suivants :

1. centraliser et harmoniser les données produits, services, packs et offres dans un référentiel unique ;
2. structurer le catalogue en briques réutilisables (produits physiques, services d'offre) assemblées en packs, puis en offres commerciales ;
3. gérer automatiquement les règles et dépendances métier (compatibilité entre produits, composition obligatoire des offres convergentes, produits vendables uniquement en pack, etc.) ;
4. maîtriser le cycle de vie complet d'une offre, de sa création à son archivage, avec un workflow de validation multi-acteurs ;
5. centraliser et contrôler la conformité des actifs numériques associés aux fiches produits (images, vidéos, notices PDF) via un DAM intégré ;
6. fournir un circuit de validation graphique dédié, distinct de la validation métier générale ;
7. gérer finement les rôles, les habilitations, et conserver un historique complet des modifications avec possibilité de rollback ;
8. notifier chaque acteur concerné à chaque étape pertinente du cycle de vie ;
9. fournir des indicateurs de pilotage (Time To Market, productivité des équipes par étape du workflow, goulots d'étranglement, taux de complétude du catalogue) ;
10. assister la production de contenu marketing (descriptions courtes/longues optimisées SEO) et l'extraction technique (auto-tagging) au moyen de modules IA ;
11. diffuser en temps réel l'information produit finalisée vers le CRM, le centre d'appel, le site web/e-boutique, les réseaux sociaux et les sites partenaires ;
12. offrir un accès mobile aux mêmes fonctionnalités que le web, sans différenciation fonctionnelle entre les deux plateformes.

### 3.1. Exigences non fonctionnelles clés (issues du cahier des charges fonctionnel)

Le cahier des charges fonctionnel de référence (CDCF v1.0) précise 182 exigences réparties en 11 modules, une matrice RACI par module et un découpage en 6 lots de réalisation. Sans reproduire l'intégralité du CDCF ici, retiens au minimum les exigences non fonctionnelles suivantes comme contraintes de conception :

- temps de réponse acceptable sur les actions courantes du catalogue et des offres (à documenter avec un seuil cible dans ARCHITECTURE.md) ;
- disponibilité du service de diffusion multicanale, avec reprise après erreur sans perte de fiche ;
- traçabilité systématique (qui, quoi, quand) sur toute action de création, modification, validation ou publication ;
- scalabilité du catalogue à un volume de produits/offres significativement supérieur au jeu de données de démonstration ;
- accessibilité et responsive design sur le frontend web, cohérence d'expérience entre web et mobile.

Si le dépôt de travail contient déjà le CDCF complet, consulte-le pour le détail exigence par exigence et la matrice RACI ; sinon, documente les hypothèses retenues dans ARCHITECTURE.md.

---

## 4. Stack technique imposée

Utilise la stack suivante sauf justification technique explicite :

| Couche | Technologie attendue |
|---|---|
| Frontend web | React (avec TypeScript recommandé) |
| Frontend mobile | Flutter |
| Backend | Java avec Spring Boot |
| API | REST JSON, OpenAPI/Swagger |
| Base de données | PostgreSQL |
| Stockage des actifs numériques (DAM) | Stockage compatible S3 (MinIO en local) |
| Traitement asynchrone / diffusion multicanale | Intergiciel de messagerie (message broker, ex. Redis Streams ou RabbitMQ) |
| Modules IA (génération de contenu, auto-tagging) | Service IA isolé derrière un adaptateur (mock si aucun accès à un modèle n'est disponible) |
| Tests API | Postman et tests automatisés |
| Modélisation | UML, Mermaid ou PlantUML |
| Conteneurisation | Docker et Docker Compose pour l'environnement local |
| Versionnement | Git avec GitHub ou GitLab |
| Sécurité | HTTPS/TLS, JWT ou session sécurisée, RBAC, validation, audit et gestion des secrets |

Ne remplace pas Spring Boot, PostgreSQL, React/Flutter ou le stockage compatible S3 sans demander une validation préalable. Si le dépôt existe déjà, commence par analyser la stack réelle et conserve les conventions existantes lorsqu'elles sont cohérentes.

---

## 5. Principe d'organisation

Contrairement à une plateforme SaaS multi-clients, cette plateforme est destinée à un usage *interne à Moov Burkina* (une seule organisation). Il n'y a donc pas de notion de tenant à isoler. En revanche, la plateforme doit intégrer dès la conception :

- une séparation stricte des périmètres de visibilité *par acteur et par fiche* (voir section 6) ;
- une architecture par domaines fonctionnels alignée sur les modules de la section 7 ;
- une capacité d'extension vers d'autres filiales du groupe Moov Africa si le besoin apparaît ultérieurement (à documenter comme perspective, non développée dans la version actuelle).

---

## 6. Utilisateurs, rôles et permissions

Implémente les acteurs suivants, avec des rôles *fixes et prédéfinis* (pas de permissions modulables au cas par cas) :

| Rôle | Responsabilités principales |
|---|---|
| Administrateur système | Comptes, rôles, audit complet, rollback, configuration des indicateurs suivis, canaux de notification, export du catalogue |
| Chef de produit | Création des produits/services/packs, assemblage des offres à partir de briques existantes, auto-tagging assisté par IA, correction/resoumission en cas de rejet |
| Analyste marketing | Enrichissement de la fiche (description marketing courte/longue assistée par IA, optimisation SEO), dépôt et association des médias, bibliothèque de médias, test A/B, suivi de son propre temps de traitement |
| Chef de service | Validation/rejet des actifs graphiques déposés (circuit dédié), validation/rejet de l'offre au niveau opérationnel avec commentaire, vue transversale sur plusieurs chefs de produit |
| Chef de département marketing et produits | Validation finale décisionnelle/stratégique (peut annuler une offre déjà validée par le chef de service sur consigne de la direction), vérification des mentions légales, publication, vue globale du Time To Market et de la productivité des équipes, rapprochement CRM |
| Community Manager | Consultation des offres publiées, préparation et programmation de campagnes de diffusion (réseaux sociaux, sites partenaires), suivi des statistiques de diffusion par canal |

Systèmes externes connectés (non-acteurs humains, reçoivent automatiquement la fiche complète dès publication) : *CRM, Centre d'appel, site web/e-boutique*. Les réseaux sociaux et sites partenaires sont diffusés manuellement/programmés par le Community Manager.

Règles de visibilité à respecter strictement :

- un chef de produit ne voit que les offres qu'il a lui-même créées, jamais celles des autres chefs de produit ;
- le chef de service a une vue transversale sur plusieurs chefs de produit et voit qui a créé quelle offre/produit ;
- les chefs de produit entre eux ne voient jamais qui a créé quel produit ;
- l'historique des modifications est consultable en intégralité par l'administrateur (avec rollback), et par chaque acteur uniquement sur ses propres fiches (lecture seule, sans rollback).

Les autorisations doivent être vérifiées côté backend, jamais uniquement dans l'interface. Une route protégée doit vérifier l'identité, le rôle, la permission, l'état du compte et le périmètre de visibilité de la ressource (créateur, statut du workflow).

Prévois les permissions sous forme de constantes ou de tables configurables, par exemple : CATALOG_READ, CATALOG_MANAGE, OFFER_CREATE, OFFER_ENRICH, ASSET_UPLOAD, ASSET_VALIDATE, OFFER_VALIDATE_OPERATIONAL, OFFER_VALIDATE_STRATEGIC, OFFER_PUBLISH, CAMPAIGN_MANAGE, ANALYTICS_TEAM_VIEW, ANALYTICS_SELF_VIEW, AUDIT_READ, AUDIT_ROLLBACK, ADMIN_MANAGE.

---

## 7. Modules fonctionnels à développer

### 7.1. Authentification et gestion des comptes

Développe la connexion, la déconnexion, le renouvellement sécurisé de session ou de token, le verrouillage après plusieurs échecs, la gestion du statut du compte et l'audit des connexions. Prévois une architecture compatible avec une évolution vers le SSO. Les mots de passe ne doivent jamais être stockés en clair. Les secrets ne doivent pas être écrits dans le dépôt.

### 7.2. Module de modélisation et gestion du catalogue

Gère trois types de briques : *produits physiques* (terminaux, équipements), *services d'offre* (forfaits data, voix, Mobile Money, etc.) et *packs* (assemblages de produits/services). Permets de créer, modifier, consulter, classer (catégories) et archiver chaque type de brique, ainsi que d'associer des produits/services à un pack. Prévois la détection de doublons à la création d'un produit et un score de qualité de fiche avant soumission.

### 7.3. Module de gestion des règles et dépendances

Modélise les contraintes métier vérifiées automatiquement au moment où le chef de produit assemble une offre : compatibilité/incompatibilité entre produits, composition obligatoire (ex. une offre convergente doit inclure data + Mobile Money), produit vendable uniquement au sein d'un pack. Le système doit bloquer ou avertir *avant* la soumission. L'administrateur doit pouvoir vérifier la cohérence globale des règles et consulter les règles appliquées.

### 7.4. Module de gestion du cycle de vie des offres

Le cycle de vie comporte les statuts suivants : *Brouillon → En enrichissement → En validation → Validée → Planifiée → Publiée → Suspendue → Obsolète → Retirée → Archivée*.

Le circuit fonctionnel est le suivant, sur une *fiche unique qui s'enrichit successivement sans silos séparés* :

1. le chef de produit crée l'offre à partir de produits/packs existants (Brouillon) ;
2. l'analyste marketing enrichit la même fiche : description, visuels, SEO, assisté par l'IA générative (En enrichissement) ;
3. le chef de service valide ou rejette avec commentaire (En validation → Validée ou retour en Brouillon pour correction) ;
4. le chef de département effectue la validation finale décisionnelle/stratégique, vérifie les mentions légales, et publie (Validée → Planifiée/Publiée) ; il peut annuler une offre déjà validée par le chef de service sur consigne de la direction ;
5. une fois publiée, l'offre peut être suspendue, rendue obsolète, retirée puis archivée.

En cas de rejet à n'importe quelle étape, le chef de produit (ou l'analyste marketing pour les actifs graphiques) corrige et resoumet ; le circuit reprend au même point.

### 7.5. Module de gestion des actifs numériques (DAM intégré)

Permets le stockage et l'association de fichiers médias (images, vidéos, notices PDF) aux fiches produits/offres, portés par l'analyste marketing. Vérifie automatiquement la conformité des médias : résolution, format, et signale les risques liés aux droits d'auteur. Prévois une bibliothèque de médias réutilisables, incluant les éléments de charte graphique du groupe Moov Africa (logos sur fond bleu et sur fond blanc/transparent, à utiliser selon le contexte d'affichage) mis à disposition des acteurs pour habiller les fiches et l'interface, et un historique visuel des versions (diff avant/après).

### 7.6. Module de workflow de validation graphique

Circuit *dédié et distinct* de la validation métier générale : le chef de service valide ou rejette spécifiquement les visuels déposés par l'analyste marketing (format, résolution, droits d'auteur), avec annotation détaillée selon le type de média (image, vidéo, PDF) et comparaison de versions. En cas de rejet, l'analyste marketing corrige et redépose. Une fois la validation graphique obtenue, l'offre poursuit vers la validation générale.

### 7.7. Module de gestion des droits et habilitations

Rôles fixes et prédéfinis (section 6). Historique complet des modifications consultable par l'administrateur (avec rollback) et par chaque acteur sur ses propres fiches uniquement (lecture seule). Journalise toute action sensible (création, modification, validation, rejet, publication, suspension, export, connexion).

### 7.8. Module de notifications

Notifie automatiquement, à chaque étape du cycle de vie : l'analyste marketing quand une offre attend son habillage ; le chef de service à la soumission ; le chef de département quand le chef de service valide ; le chef de produit en cas de rejet et de publication ; le community manager à la publication.

### 7.9. Module analytics et KPIs

Suivi du *Time To Market* (temps entre création et mise en ligne) et de la *productivité des équipes par étape du workflow*, avec identification des goulots d'étranglement, réservés à la vue globale du chef de département (pilotage stratégique). L'analyste marketing ne voit que son propre temps de traitement individuel. Prévois également le taux de complétude du catalogue et un rapprochement avec les données CRM (croisé ventes/offres).

### 7.10. Module IA de génération automatique de contenu

Deux fonctions distinctes à ne pas confondre :

- *auto-tagging / classification intelligente* : extraction automatique de données depuis des fiches techniques, côté chef de produit, à la création du produit/offre (catégorie, caractéristiques, tags) ;
- *génération de contenu marketing* : descriptions courtes et longues optimisées pour le SEO à partir des caractéristiques techniques, côté analyste marketing, dans la phase d'enrichissement.

Prévois également un assistant conversationnel interne et un mécanisme de recherche sémantique dans le catalogue. Isole tout appel à un modèle IA derrière un adaptateur, avec un mode mock clairement identifié si aucun accès n'est disponible.

### 7.11. Module de diffusion et intégration multicanale

Dès publication, la fiche complète est automatiquement diffusée en temps réel vers le *CRM, le centre d'appel et le site web/e-boutique* (API ou export). Le Community Manager diffuse en plus manuellement, ou programme la diffusion à une date/heure future, vers les *réseaux sociaux* (Facebook, Instagram, LinkedIn, etc.) et les *sites partenaires*, et consulte ensuite les statistiques de diffusion (vues, clics, engagement) par canal. L'administrateur peut exporter le catalogue de façon autonome (sans lien direct avec le CRM).

### 7.12. Mobile

L'application mobile (Flutter) donne accès aux *mêmes fonctionnalités que le web, par acteur, sans différenciation fonctionnelle* — il s'agit d'une adaptation de l'interface, pas d'un périmètre fonctionnel réduit.

---

## 8. Modèle de données minimal

Propose et implémente des migrations PostgreSQL pour les tables suivantes ou leur équivalent justifié :

- users ;
- roles ;
- permissions ;
- user_roles ;
- products (produits physiques) ;
- services (services d'offre) ;
- packs ;
- pack_items (association produits/services ↔ packs) ;
- categories ;
- business_rules (règles et dépendances) ;
- offers ;
- offer_versions (historique des versions, pour le rollback) ;
- offer_status_history (traçabilité du cycle de vie) ;
- media_assets ;
- media_validations (validation graphique, annotations) ;
- notifications ;
- audit_logs ;
- kpi_events (événements pour le calcul du Time To Market et de la productivité) ;
- ab_tests (test A/B sur le contenu marketing d'une offre, variantes, métrique suivie, gagnant) ;
- duplicate_flags (rapprochements de doublons détectés à la création d'un produit) ;
- campaigns (diffusion réseaux sociaux/sites partenaires) ;
- campaign_channels ;
- campaign_stats ;
- integration_exports (exports/diffusions vers CRM, centre d'appel, site web) ;
- idempotency_keys.

Ajoute les contraintes d'unicité, index, clés étrangères, colonnes d'état, timestamps, version optimiste (pour supporter le rollback) et stratégie de suppression logique lorsque les données doivent être conservées pour l'audit.

---

## 9. API REST attendue

Conçois une API documentée OpenAPI. Utilise des DTO distincts des entités de persistance. Retourne des erreurs homogènes avec un identifiant de corrélation.

Exemples de routes :

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/me

GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/{userId}

GET    /api/v1/products
POST   /api/v1/products
POST   /api/v1/products/check-duplicate
GET    /api/v1/services
POST   /api/v1/services
GET    /api/v1/packs
POST   /api/v1/packs
POST   /api/v1/packs/{packId}/items
GET    /api/v1/catalog/search

GET    /api/v1/business-rules
POST   /api/v1/business-rules
POST   /api/v1/business-rules/check

GET    /api/v1/offers
POST   /api/v1/offers
POST   /api/v1/offers/{offerId}/enrich
GET    /api/v1/offers/{offerId}/quality-score
POST   /api/v1/offers/{offerId}/submit
POST   /api/v1/offers/{offerId}/validate-graphics
POST   /api/v1/offers/{offerId}/validate-operational
POST   /api/v1/offers/{offerId}/validate-strategic
POST   /api/v1/offers/{offerId}/publish
POST   /api/v1/offers/{offerId}/suspend
POST   /api/v1/offers/{offerId}/archive
GET    /api/v1/offers/{offerId}/history
POST   /api/v1/offers/{offerId}/rollback

POST   /api/v1/media/upload
POST   /api/v1/media/{mediaId}/validate
POST   /api/v1/offers/{offerId}/ab-tests
GET    /api/v1/offers/{offerId}/ab-tests/{testId}/results

GET    /api/v1/campaigns
POST   /api/v1/campaigns
POST   /api/v1/campaigns/{campaignId}/schedule
GET    /api/v1/campaigns/{campaignId}/stats

POST   /api/v1/ai/generate-description
POST   /api/v1/ai/auto-tag
POST   /api/v1/assistant/query

GET    /api/v1/reports/time-to-market
GET    /api/v1/reports/team-productivity
GET    /api/v1/reports/catalog-completeness

POST   /api/v1/integrations/crm/export
POST   /api/v1/integrations/call-center/export
POST   /api/v1/integrations/website/sync

GET    /api/v1/audit-logs
GET    /api/v1/health
```

Les endpoints d'administration doivent être séparés conceptuellement des endpoints métier. Les routes d'intégration sortante ne doivent pas être traitées comme des endpoints publics ordinaires.

---

## 10. Architecture backend Spring Boot

Organise le backend par domaines ou modules plutôt que par un unique paquetage technique illisible. Une structure acceptable est :

```text
backend/
  src/main/java/.../
    config/
    security/
    shared/
      error/
      audit/
      idempotency/
    identity/
    catalog/
      product/
      service/
      pack/
    rules/
    offer/
      lifecycle/
      history/
    media/
      dam/
      graphicvalidation/
    notification/
    analytics/
    ai/
      contentgen/
      autotagging/
    distribution/
      crm/
      callcenter/
      website/
      social/
```

Chaque domaine peut contenir controller, application, domain, infrastructure, repository et mapper selon le niveau de complexité.

Utilise une gestion d'erreurs globale, des logs structurés, des validations Bean Validation, des transactions explicites, des tests de services, des tests d'intégration et une configuration par environnement.

---

## 11. Architecture frontend Web (React) et Mobile (Flutter)

Organise le frontend web par fonctionnalités :

```text
frontend-web/
  src/
    pages/
      login/
      dashboard/
      catalog/
      offers/
      media/
      campaigns/
      analytics/
      audit/
      admin/
    components/
    features/
    lib/
      api-client/
      auth/
      permissions/
      validation/
    types/
    tests/
```

L'interface doit être professionnelle, responsive, accessible, inspirée des standards PIM/télécom (Akeneo, Amdocs Catalog, Netcracker). Prévois un menu latéral, un fil d'Ariane, une vue Kanban pour le suivi des offres, une recherche sémantique, des tableaux filtrables, des formulaires validés, des confirmations d'action, des états de chargement, des états vides, des messages d'erreur et une gestion claire des permissions par acteur.

L'application mobile (Flutter, Dart) réutilise la même logique métier et les mêmes écrans fonctionnels que le web, adaptés au format mobile — sans réduction du périmètre fonctionnel par acteur. Consomme la même API REST que le frontend web. Organise-la par fonctionnalités, sur le même découpage que le web :

```text
mobile/
  lib/
    screens/
      login/
      dashboard/
      catalog/
      offers/
      media/
      campaigns/
      analytics/
      admin/
    widgets/
    features/
    services/
      api_client/
      auth/
      permissions/
    models/
  test/
```

Utilise un gestionnaire d'état explicite (Riverpod ou Bloc) plutôt qu'une gestion d'état ad hoc dispersée dans les widgets.

Ne cache pas uniquement les boutons interdits : les permissions doivent aussi être vérifiées par l'API.

---

## 12. Sécurité et conformité technique

Applique au minimum les mesures suivantes :

- validation et normalisation de toutes les entrées ;
- prévention des injections SQL grâce à l'accès paramétré ou ORM ;
- protection CORS limitée aux origines nécessaires ;
- cookies sécurisés si une session est utilisée ;
- expiration et rotation des tokens ;
- limitation des tentatives de connexion ;
- masquage des secrets dans les logs ;
- gestion des secrets par variables d'environnement ou coffre adapté ;
- TLS pour les flux externes ;
- contrôle RBAC backend sur chaque route, y compris le périmètre de visibilité par créateur ;
- vérification de la conformité des médias (format, résolution, droits d'auteur) avant validation ;
- audit des actions sensibles avec traçabilité et rollback réservé à l'administrateur ;
- sauvegardes chiffrées ;
- minimisation des données personnelles ;
- absence de données de production dans Git, fixtures publiques ou captures.

Ajoute un fichier SECURITY.md décrivant les hypothèses, les risques connus, les secrets nécessaires et la procédure de signalement d'une vulnérabilité.

---

## 13. Docker, déploiement et exploitation

Fournis un environnement local reproductible avec Docker Compose comprenant, selon le besoin :

- frontend web React ;
- backend Spring Boot ;
- application mobile Flutter (compilée séparément, hors Docker Compose — elle consomme l'API exposée par le backend) ;
- PostgreSQL ;
- stockage compatible S3 (MinIO) ;
- intergiciel de messagerie (message broker) ;
- reverse proxy optionnel.

Sépare les configurations local, test, staging et production. Ne commite jamais les fichiers .env contenant des secrets. Fournis un .env.example documenté.

Ajoute :

- health checks ;
- logs lisibles ;
- procédure de migration ;
- procédure de sauvegarde et restauration ;
- procédure de rollback applicatif (au sens infrastructure) distincte du rollback fonctionnel sur les fiches offres ;
- rétention des logs ;
- indicateurs de disponibilité et de latence.

---

## 14. Tests obligatoires

### Tests fonctionnels

Vérifie l'authentification, le RBAC par acteur, la création de produit/service/pack, la vérification des règles et dépendances, la création et l'enrichissement d'une offre, le circuit de validation graphique, la validation opérationnelle et stratégique, la publication, la suspension/archivage, les notifications déclenchées à chaque étape, et la diffusion multicanale.

### Tests de visibilité et de périmètre

Vérifie qu'un chef de produit ne peut jamais consulter les offres créées par un autre chef de produit, même en modifiant un identifiant dans l'URL. Vérifie que le rollback n'est accessible qu'à l'administrateur.

### Tests d'idempotence

Soumets deux fois la même action de diffusion/export. Le système doit empêcher la création de doublons.

### Tests de sécurité

Teste les routes sans authentification, les rôles insuffisants, les entrées invalides, les tentatives de dépassement de périmètre, les tokens expirés et les paramètres inattendus.

### Tests de résilience

Teste l'indisponibilité du service IA, l'indisponibilité du CRM/centre d'appel/site web, les retries, la reprise après erreur, et la restauration PostgreSQL.

### Tests API

Fournis une collection Postman exportable et, si possible, des tests automatisés reproductibles dans le pipeline CI.

Chaque test doit préciser : identifiant, objectif, prérequis, données, étapes, résultat attendu, résultat obtenu, statut et preuve.

---

## 15. Livrables obligatoires

```text
README.md
ARCHITECTURE.md
SECURITY.md
API.md ou openapi.yaml
DATA_MODEL.md
DEPLOYMENT.md
RUNBOOK.md
TEST_PLAN.md
CHANGELOG.md
.env.example
docker-compose.yml
Dockerfiles
migrations PostgreSQL
fixtures fictives
collection Postman
diagrammes UML (cas d'utilisation, séquence, classes)
```

Le README doit expliquer l'installation complète à partir d'un environnement vierge, les commandes de lancement, les comptes de démonstration (un par acteur), les variables d'environnement et les limites connues.

---

## 16. Méthode de travail obligatoire

Ne génère pas toute l'application en une seule réponse et ne détruis pas le dépôt existant sans sauvegarde.

Travaille selon les étapes suivantes :

### Étape 0 — Inspection

Analyse le dépôt, les fichiers existants, la version de Node, Java, Maven ou Gradle, les conventions, les scripts, les dépendances, les fichiers de configuration et les contraintes de l'environnement. Fournis un diagnostic avant toute modification importante.

### Étape 1 — Plan validé

Propose un plan de travail avec les phases, les fichiers concernés, les risques et les critères d'acceptation. Identifie ce qui est réellement réalisable dans le délai du stage et ce qui appartient à l'architecture cible.

### Étape 2 — Socle

Mets en place la structure frontend web/mobile, backend, PostgreSQL, stockage compatible S3, Docker, les migrations, les variables d'environnement, la gestion d'erreurs et un premier health check.

### Étape 3 — Identité et rôles

Implémente l'authentification, les rôles fixes, les permissions, les contrôles de périmètre de visibilité et les premiers tests de sécurité.

### Étape 4 — Catalogue et règles

Implémente produits, services, packs, catégories et le module de règles et dépendances, avec migrations, validations, API et interface.

### Étape 5 — Cycle de vie et workflow

Implémente les offres, leur cycle de vie à 10 statuts, le circuit de validation graphique, la validation opérationnelle et stratégique, l'historique et le rollback.

### Étape 6 — DAM, IA et notifications

Implémente le module de gestion des actifs numériques, les adaptateurs IA (génération de contenu, auto-tagging, mock si nécessaire) et les notifications par étape.

### Étape 7 — Analytics et diffusion

Implémente les indicateurs (Time To Market, productivité, complétude du catalogue), les campagnes de diffusion et les intégrations CRM/centre d'appel/site web (mock si nécessaire).

### Étape 8 — Tests, documentation et démonstration

Exécute les tests fonctionnels, API, périmètre, sécurité, idempotence et résilience. Mets à jour README, architecture, API, modèle de données, plan de tests et guide de démonstration. Prépare un scénario de soutenance de 10 à 15 minutes.

À chaque étape, indique : ce qui a été réalisé, les fichiers modifiés, les commandes exécutées, les tests passés, les limites et l'étape suivante.

---

## 17. Critères d'acceptation globaux

Le développement est considéré comme acceptable lorsque :

1. l'application démarre localement avec une procédure documentée ;
2. le frontend web (et si possible mobile) communique avec l'API backend ;
3. PostgreSQL persiste les données et les migrations sont reproductibles ;
4. l'authentification et le RBAC par acteur fonctionnent côté backend ;
5. les périmètres de visibilité (chef de produit, chef de service, etc.) sont vérifiés par des tests ;
6. le catalogue (produits, services, packs) et les règles/dépendances sont gérés ;
7. une offre peut parcourir l'intégralité du cycle de vie, de la création à la publication ;
8. le circuit de validation graphique fonctionne indépendamment de la validation métier ;
9. le DAM stocke et vérifie la conformité des médias ;
10. les modules IA (génération de contenu, auto-tagging) fonctionnent via un mock ou un service réel selon les accès disponibles ;
11. les notifications sont déclenchées aux bonnes étapes ;
12. les indicateurs Time To Market et productivité sont calculés et visibles selon le bon périmètre ;
13. la diffusion multicanale (CRM, centre d'appel, site web, réseaux sociaux, sites partenaires) est démontrée, au moins en mock ;
14. l'audit et le rollback sont consultables et fonctionnels pour l'administrateur ;
15. les tests critiques sont reproductibles ;
16. aucune clé, donnée réelle ou information confidentielle n'est exposée ;
17. la documentation permet à un autre développeur de reprendre le projet.

---

## 18. Règles de vérité et de présentation

Tu dois distinguer dans le code et dans la documentation les éléments suivants :

- *Réalisé :* fonctionnalité codée, testée et démontrable ;
- *Conçu :* fonctionnalité définie dans l'architecture mais dépendante d'une intégration, d'une donnée ou d'un accès non disponible ;
- *Simulé :* fonctionnalité représentée par un mock ou des fixtures ;
- *Perspective :* évolution non développée dans la version actuelle (par exemple l'extension à d'autres filiales du groupe Moov Africa).

Ne prétends pas avoir connecté le CRM, le centre d'appel ou le site web réels de Moov Burkina si aucun accès ne t'a été fourni. Ne prétends pas avoir appelé un vrai service IA si seul un mock est disponible. Ne fournis pas de clés ou credentials fictifs en les présentant comme valides. Utilise des placeholders clairement nommés.

---

## 19. Réponse attendue après chaque phase

À la fin de chaque phase, réponds avec le format suivant :

```text
PHASE TERMINÉE : [nom de la phase]

Réalisé :
- ...

Fichiers créés ou modifiés :
- ...

Tests exécutés :
- ...

Résultats :
- ...

Limites ou hypothèses :
- ...

Décisions requises avant la suite :
- ...

Prochaine phase proposée :
- ...
```

Commence maintenant par *inspecter l'environnement ou le dépôt existant*, puis produis un diagnostic et un plan d'implémentation détaillé. Ne commence pas par écrire une grande quantité de code sans vérifier l'état réel du projet.

---

# VARIANTE D'UTILISATION POUR CLAUDE CODE

Après avoir collé le prompt maître, ajoute :

> Tu travailles directement dans le dépôt local. Commence par afficher l'arborescence, les fichiers de configuration, les versions disponibles, les scripts de démarrage et les tests existants. Ne supprime aucun fichier avant d'avoir proposé une stratégie de migration. Crée une branche ou un point de restauration avant les changements importants. Implémente progressivement, exécute les tests après chaque phase et montre les fichiers réellement modifiés.

# VARIANTE D'UTILISATION POUR CODE WEB

Après avoir collé le prompt maître, ajoute :

> Initialise ou ouvre le projet dans l'environnement fourni. Si le scaffold ne permet pas exactement Spring Boot, PostgreSQL, Flutter ou un backend sécurisé, indique la limite avant de commencer et propose une architecture de démonstration compatible. Génère d'abord le schéma fonctionnel, l'architecture, le modèle de données et le backlog. Ensuite seulement, crée les écrans et les services. Toute intégration externe doit être placée derrière un adaptateur et fonctionner en mode mock sans secret.

# PREMIÈRE DEMANDE À ENVOYER

> Commence par analyser l'environnement disponible, produire l'arborescence cible, la liste des modules, le modèle de données initial, les diagrammes à créer, le backlog priorisé sur la durée du stage, les risques techniques et les critères de démonstration. Ne code pas encore les modules métier tant que ce diagnostic n'est pas présenté.

# SUITE DES DEMANDES À ENVOYER

> Envoie chaque demande une fois que la précédente est terminée et que Claude Code (ou Code Web) a répondu au format « PHASE TERMINÉE » défini en section 19. N'envoie pas plusieurs demandes d'un coup dans un même message : chaque étape doit être validée avant de passer à la suivante, car les décisions d'une étape peuvent changer les hypothèses de la suivante.

### 2ᵉ demande — validation du plan (Étape 1)

> Sur la base du diagnostic précédent, propose le plan de travail détaillé de l'Étape 1 : phases, fichiers concernés, risques, critères d'acceptation, et ce qui est réellement réalisable dans la durée du stage (01 juin – 30 août) par rapport à ce qui relève de l'architecture cible. N'écris encore aucun code métier. Attends ma validation avant de commencer le socle.

### 3ᵉ demande — socle technique (Étape 2)

> Passe à l'Étape 2. Mets en place la structure frontend web (React) et le squelette mobile (Flutter), le backend Spring Boot, PostgreSQL, le stockage compatible S3, Docker Compose, les migrations initiales, les variables d'environnement (.env.example), la gestion d'erreurs globale et un premier health check. Termine par le format « PHASE TERMINÉE ».

### 4ᵉ demande — identité et rôles (Étape 3)

> Passe à l'Étape 3. Implémente l'authentification, les 6 rôles fixes (Administrateur système, Chef de produit, Chef de service, Chef de département marketing et produits, Analyste marketing, Community Manager), les permissions associées, et les contrôles de périmètre de visibilité (un chef de produit ne voit que ses propres offres ; le chef de service a une vue transversale). Ajoute les premiers tests de sécurité et de périmètre. Termine par le format « PHASE TERMINÉE ».

### 5ᵉ demande — catalogue et règles (Étape 4)

> Passe à l'Étape 4. Implémente les produits physiques, les services d'offre, les packs, les catégories, la détection de doublons et le module de règles et dépendances (compatibilité entre produits, composition obligatoire des offres convergentes, produits vendables uniquement en pack), avec migrations, validations, API et interface web. Termine par le format « PHASE TERMINÉE ».

### 6ᵉ demande — cycle de vie et workflow (Étape 5)

> Passe à l'Étape 5. Implémente les offres et leur cycle de vie à 10 statuts (Brouillon → En enrichissement → En validation → Validée → Planifiée → Publiée → Suspendue → Obsolète → Retirée → Archivée), le circuit de validation graphique dédié (distinct de la validation métier), la validation opérationnelle (chef de service) puis stratégique (chef de département, avec vérification des mentions légales), le score de qualité de fiche avant soumission, l'historique des versions et le rollback réservé à l'administrateur. Termine par le format « PHASE TERMINÉE ».

### 7ᵉ demande — DAM, IA et notifications (Étape 6)

> Passe à l'Étape 6. Implémente le module de gestion des actifs numériques (upload, vérification de conformité résolution/format/droits d'auteur, bibliothèque de médias incluant les logos Moov Africa), les adaptateurs IA (génération de description marketing courte/longue optimisée SEO, auto-tagging, assistant conversationnel, recherche sémantique — en mock si aucun accès à un modèle n'est disponible), le test A/B sur le contenu marketing, et les notifications à chaque étape du cycle de vie. Termine par le format « PHASE TERMINÉE ».

### 8ᵉ demande — analytics et diffusion (Étape 7)

> Passe à l'Étape 7. Implémente les indicateurs (Time To Market avec identification des goulots d'étranglement, productivité des équipes réservée au chef de département, temps de traitement individuel pour l'analyste marketing, taux de complétude du catalogue, rapprochement CRM), les campagnes de diffusion du Community Manager (réseaux sociaux, sites partenaires, programmation différée, statistiques par canal), et les intégrations sortantes vers CRM, centre d'appel et site web (en mock si nécessaire). Termine par le format « PHASE TERMINÉE ».

### 9ᵉ demande — tests, documentation et démonstration (Étape 8)

> Passe à l'Étape 8. Exécute l'ensemble des tests fonctionnels, de périmètre, de sécurité, d'idempotence et de résilience. Mets à jour tous les livrables (README, ARCHITECTURE.md, SECURITY.md, API.md/openapi.yaml, DATA_MODEL.md, DEPLOYMENT.md, RUNBOOK.md, TEST_PLAN.md, CHANGELOG.md). Prépare un scénario de démonstration de 10 à 15 minutes couvrant un cycle complet (création d'une offre par le chef de produit jusqu'à sa diffusion multicanale par le community manager), avec un compte de démonstration par acteur.

### Demandes complémentaires ponctuelles (à utiliser au besoin, hors séquence principale)

> « Relis le code déjà produit et vérifie qu'aucune donnée réelle, clé ou credential n'est exposée dans le dépôt, les fixtures ou les captures. »

> « Vérifie que chaque route protégée contrôle bien le rôle ET le périmètre de visibilité (créateur de la fiche), pas seulement l'authentification. »

> « Génère la collection Postman complète couvrant tous les endpoints listés dans le prompt maître, avec des exemples de succès et d'échec pour chacun. »
