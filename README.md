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

## Première connexion

Les comptes administrateurs traversent deux étapes obligatoires avant d'accéder aux
écrans métier. Les deux sont prises en charge par l'interface, qui redirige vers la
page Profil à chaque fois.

Le compte livré par les migrations est `admin@moov-africa.bf`, mot de passe
`MoovPim@2026!` (posé par `V031__reset_seeded_admin_password.sql`). Il n'ouvre que
la première connexion : le drapeau `force_password_change` impose d'en choisir un
autre immédiatement.

1. **Changement du mot de passe** — les comptes livrés portent le drapeau
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
