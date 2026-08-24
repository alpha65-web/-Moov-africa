# Moov Africa PIM

Plateforme de gestion de l'information produits et offres (Product Information Management) pour Moov Africa Burkina Faso.

## Architecture

Monorepo organisé en deux modules :

```
├── backend/          Spring Boot 3.4 · Java 21 · PostgreSQL · MinIO
├── frontend/         Next.js · React · TypeScript
└── docker-compose.yml
```

### Modules backend

| Module | Description |
|---|---|
| `catalog` | Produits, services, packs et catégories |
| `lifecycle` | Offres commerciales et workflow de statut |
| `dam` | Gestion des médias (Digital Asset Management) via MinIO, tests A/B |
| `permissions` | Authentification JWT, RBAC, utilisateurs et rôles |
| `rules` | Règles métier configurables |
| `campaign` | Campagnes marketing multicanal |
| `integration` | Exports vers systèmes tiers |
| `notification` | Notifications et alertes configurables |
| `analytics` | Audit trail et KPIs |
| `ai` | Analyse de qualité du référentiel, assistance et génération de contenu |
| `shared` | Configuration transverse, sécurité, réglages de la plateforme |

Le module `ai` s'appuie exclusivement sur les données présentes en base : il ne fait
appel à aucun service externe et ne nécessite aucune clé d'API.

## Prérequis

- Java 21
- Node.js 18+
- Maven 3.9+
- Docker & Docker Compose
- PostgreSQL 16+ (via Docker, ou une instance locale)

## Démarrage rapide

### Tout par Docker

```bash
cp .env.example .env    # renseigner les valeurs
docker compose up -d
```

Démarre PostgreSQL, MinIO, le backend (port 8092) et le frontend (port 3000).
Les services optionnels (sauvegardes, antivirus, Vault, WAF, supervision) sont
derrière des profils Compose et ne démarrent pas par défaut :

```bash
docker compose --profile monitoring up -d      # Prometheus, Grafana, Loki
docker compose --profile antivirus up -d       # ClamAV
```

### Avec un PostgreSQL déjà installé sur la machine

Le PostgreSQL du Compose écoute sur le 5432 du conteneur et entre donc en conflit
avec une instance locale occupant déjà ce port. Si vous utilisez votre PostgreSQL
local, ne démarrez de Docker que MinIO :

```bash
docker compose up -d minio
```

Pour faire cohabiter les deux, créez un `docker-compose.override.yml` — non versionné,
propre à votre poste — qui republie PostgreSQL sur un port libre :

```yaml
services:
  postgres:
    ports:
      - "5433:5432"
    networks: [backend-net, devhost-net]
  minio:
    ports: ["9000:9000", "9001:9001"]
    networks: [backend-net, devhost-net]
networks:
  devhost-net:
    driver: bridge
```

`backend-net` est déclaré `internal: true` : Docker refuse de publier un port pour un
conteneur rattaché à ce seul réseau, d'où le réseau `devhost-net` supplémentaire.

Créez au préalable la base et son utilisateur :

```sql
CREATE USER pim WITH PASSWORD 'pim_local';
CREATE DATABASE pim_db OWNER pim;
```

**Backend** — les identifiants n'ont volontairement aucune valeur par défaut, le
service refuse de démarrer sans eux :

```bash
cd backend
SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/pim_db" \
SPRING_DATASOURCE_USERNAME=pim \
SPRING_DATASOURCE_PASSWORD=pim_local \
JWT_SECRET='...32 caractères minimum...' \
PIM_ENCRYPTION_KEY='...32 caractères minimum...' \
MINIO_ACCESS_KEY=minioadmin \
MINIO_SECRET_KEY=minioadmin123 \
mvn spring-boot:run
```

Le backend démarre sur `http://localhost:8092/api/v1` et applique les migrations
Flyway automatiquement.

**Frontend :**

```bash
cd frontend
npm install
npm run dev
```

Le frontend démarre sur `http://localhost:3000`.

## Comptes livrés

Les migrations installent **un seul compte administrateur** et **un compte par rôle
métier**, afin que chaque écran puisse être parcouru avec les permissions réelles du
rôle qui l'utilise au quotidien.

| Compte | Rôle | Mot de passe | Posé par |
|---|---|---|---|
| `alpha@moov-africa.bf` | Administrateur système | *défini à la première connexion* | `V022` |
| `chef.produit@moov-africa.bf` | Chef de produit | `MoovProduit@2026!` | `V032` |
| `chef.produit2@moov-africa.bf` | Chef de produit (second) | `MoovProduit2@2026!` | `V036` |
| `chef.service@moov-africa.bf` | Chef de service | `MoovService@2026!` | `V032` |
| `chef.departement@moov-africa.bf` | Chef de département | `MoovDepartement@2026!` | `V032` |
| `community.manager@moov-africa.bf` | Community manager | `MoovCommunity@2026!` | `V032` |
| `analyste.marketing@moov-africa.bf` | Analyste marketing | `MoovAnalyste@2026!` | `V032` |

`admin@moov-africa.bf` et `watta@moov-africa.bf` ont été supprimés par
`V033__remove_extra_admin_accounts.sql` : trois administrateurs empêchaient de
démontrer le cloisonnement des rôles. Les contenus dont ils étaient les auteurs ont
été repris par `alpha@moov-africa.bf`, et les cinq offres qu'ils avaient enrichies
par le compte analyste marketing, seul porteur de la permission `OFFER_ENRICH`.

Les cinq comptes métier se connectent directement : ils ne portent pas le drapeau
`force_password_change` et ne sont pas soumis à la double authentification, que
`MfaPolicyFilter` n'exige que d'`ADMIN_SYSTEME` et `SUPER_ADMIN`.

## Circuit de validation

Chaque transition exige la permission de l'étape correspondante, contrôlée par
`OfferService` où le statut cible est connu. Détenir une permission du cycle de vie
n'ouvre pas les autres : un chef de produit ne peut pas publier sa propre offre.

| Étape | Statut atteint | Permission exigée | Rôle |
|---|---|---|---|
| Soumettre à enrichissement | `IN_ENRICHMENT` | `OFFER_SUBMIT` | chef de produit |
| Enrichir les contenus | *(reste `IN_ENRICHMENT`)* | `OFFER_ENRICH` | analyste marketing |
| Soumettre à validation | `IN_VALIDATION` | `OFFER_SUBMIT` | chef de produit |
| Valider | `VALIDATED` | `OFFER_VALIDATE` | chef de service |
| Rejeter vers l'enrichissement | `IN_ENRICHMENT` | `OFFER_VALIDATE` | chef de service |
| Planifier, publier, suspendre, retirer | `PLANNED`, `PUBLISHED`, … | `OFFER_PUBLISH` | chef de département |

Chaque franchissement notifie l'acteur de l'étape suivante, désigné par sa permission
et non par un rôle codé en dur, ainsi que l'auteur de la fiche pour les décisions qui
la concernent. L'acteur qui vient d'agir n'est jamais son propre destinataire. Le
nombre de notifications non lues s'affiche sur l'icône de la barre latérale.

Conséquence de ce routage par permission : l'administrateur, qui détient toutes les
permissions, reçoit toutes les notifications de cycle de vie. C'est cohérent avec son
rôle de supervision.

## Périmètres de visibilité

Deux régimes coexistent, conformément aux règles de visibilité du cahier des charges.

- **Chef de produit** — cloisonné à ses propres fiches : « un chef de produit ne voit
  que les offres qu'il a lui-même créées, jamais celles des autres chefs de produit ».
- **Tous les autres rôles** — vue transversale. Le chef de service valide, le chef de
  département publie, l'analyste marketing enrichit, le community manager diffuse :
  leurs permissions (`OFFER_VALIDATE`, `OFFER_PUBLISH`, `OFFER_ENRICH`,
  `CAMPAIGN_MANAGE`) porteraient sur un ensemble vide s'ils étaient cloisonnés.

Le choix est porté par `RoleName.hasTransversalScope()` et appliqué par `OfferService`,
`CatalogService` et `CampaignService`. Il ne décide que du périmètre : les permissions
restent vérifiées en amont par les annotations `@PreAuthorize` des contrôleurs.
`OfferVisibilityScopeTest` couvre les deux régimes.

## Première connexion administrateur

Le compte administrateur traverse deux étapes obligatoires avant d'accéder aux
écrans métier. Les deux sont prises en charge par l'interface, qui redirige vers la
page Profil à chaque fois.

1. **Changement du mot de passe** — `alpha@moov-africa.bf` porte le drapeau
   `force_password_change`. Tant qu'il n'est pas levé, tous les endpoints répondent
   `403 FORCE_PASSWORD_CHANGE`, à l'exception de `/users/me` et `/auth/change-password`.
2. **Enrôlement de la double authentification** — les rôles `ADMIN_SYSTEME` et
   `SUPER_ADMIN` doivent activer le TOTP. Sans cela les endpoints répondent
   `403 MFA_REQUIRED_FOR_ADMIN`. La page Profil affiche un QR code à scanner depuis
   Google Authenticator, Authy ou Microsoft Authenticator.

Les connexions suivantes réclament le code à six chiffres : sans lui le serveur
répond `403 MFA_REQUIRED` et l'écran de connexion fait apparaître le champ dédié.

Sur un poste dépourvu d'application d'authentification, l'exigence peut être levée :

```bash
PIM_MFA_REQUIRE_FOR_ADMIN=false mvn spring-boot:run
```

Le réglage reste actif par défaut : c'est une exigence de sécurité en production.

## Configuration

### Variables d'environnement backend

Les variables sans valeur par défaut sont **obligatoires**.

| Variable | Description | Défaut |
|---|---|---|
| `JWT_SECRET` | Clé secrète JWT (min. 32 caractères) | *obligatoire* |
| `PIM_ENCRYPTION_KEY` | Clé de chiffrement at-rest AES-256-GCM (min. 32 caractères) | *obligatoire* |
| `SPRING_DATASOURCE_USERNAME` | Utilisateur BDD | *obligatoire* |
| `SPRING_DATASOURCE_PASSWORD` | Mot de passe BDD | *obligatoire* |
| `MINIO_ACCESS_KEY` | Clé d'accès MinIO | *obligatoire* |
| `MINIO_SECRET_KEY` | Clé secrète MinIO | *obligatoire* |
| `SPRING_DATASOURCE_URL` | URL JDBC PostgreSQL | `jdbc:postgresql://localhost:5432/pim_db` |
| `PIM_MINIO_ENDPOINT` | Endpoint MinIO | `http://localhost:9000` |
| `PIM_CORS_ORIGINS` | Origines CORS autorisées | `http://localhost:3000` |
| `PIM_MFA_REQUIRE_FOR_ADMIN` | Double authentification obligatoire pour les administrateurs | `true` |
| `PIM_SWAGGER_ENABLED` | Exposer Swagger UI | `false` |
| `PIM_CLAMAV_ENABLED` | Analyse antivirus des fichiers déposés | `false` |

### Variables d'environnement frontend

| Variable | Description | Défaut |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de base de l'API | `http://localhost:8092/api/v1` |

### API

Swagger n'est exposé que si `PIM_SWAGGER_ENABLED=true` :

- Swagger UI : `http://localhost:8092/api/v1/swagger-ui.html`
- OpenAPI JSON : `http://localhost:8092/api/v1/api-docs`

## Internationalisation

L'interface est disponible en 46 langues. Le français est la langue de référence :
toute clé absente d'une traduction retombe sur son libellé français plutôt que
d'afficher le chemin brut de la clé. Le français et l'anglais sont complets, les
autres locales sont partiellement traduites.

La langue est portée par le cookie `locale` et se change depuis la barre latérale.

## Sécurité

- Authentification JWT avec refresh tokens et empreinte de session
- RBAC : 7 rôles et 17 permissions granulaires, exposées à l'interface pour filtrer
  la navigation sur les écrans réellement accessibles
- Double authentification TOTP, obligatoire pour les comptes administrateurs
- Politique de mot de passe : 12 caractères minimum, majuscule, minuscule, chiffre,
  caractère spécial, et refus des mots de passe présents dans une fuite connue
  (Have I Been Pwned)
- Rate limiting sur les endpoints d'authentification
- Verrouillage de compte après 5 tentatives échouées
- Validation MIME des uploads (liste blanche) et analyse antivirus optionnelle
- Headers de sécurité (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Conteneur Docker non-root

## Tests

```bash
cd backend
mvn test
```

348 tests unitaires couvrant l'ensemble des modules.

```bash
cd frontend
npx tsc --noEmit    # vérification des types
npm run build       # build de production
```

## Base de données

30 migrations Flyway, appliquées automatiquement au démarrage du backend. Elles
incluent un jeu de données de démonstration (catalogue, offres, campagnes, règles
métier, historique d'exports et d'indicateurs) ainsi que la configuration des
notifications et des KPIs.

## Stack technique

**Backend :** Spring Boot 3.4.1, Spring Security, Spring Modulith, Flyway, JPA/Hibernate, MinIO SDK, SpringDoc OpenAPI

**Frontend :** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl

**Infrastructure :** PostgreSQL, MinIO, Docker Compose
