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
| `dam` | Gestion des médias (Digital Asset Management) via MinIO |
| `permissions` | Authentification JWT, RBAC, utilisateurs et rôles |
| `rules` | Règles métier configurables |
| `campaign` | Campagnes marketing multicanal |
| `integration` | Exports vers systèmes tiers |
| `notification` | Notifications et alertes configurables |
| `analytics` | Audit trail et KPIs |

## Prérequis

- Java 21
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16 (ou via Docker)
- Maven 3.9+

## Démarrage rapide

### Avec Docker (recommandé)

```bash
docker compose up -d
```

Cela démarre PostgreSQL, MinIO, le backend (port 8092) et le frontend (port 3000).

### Sans Docker

**Backend :**

```bash
cd backend
mvn spring-boot:run
```

Le backend démarre sur `http://localhost:8092/api/v1`.

**Frontend :**

```bash
cd frontend
npm install
npm run dev
```

Le frontend démarre sur `http://localhost:3000`.

## Configuration

### Variables d'environnement backend

| Variable | Description | Défaut (dev) |
|---|---|---|
| `JWT_SECRET` | Clé secrète JWT (min 32 caractères) | `changeme-dev-only-...` |
| `SPRING_DATASOURCE_URL` | URL JDBC PostgreSQL | `jdbc:postgresql://localhost:5432/pim_db` |
| `SPRING_DATASOURCE_USERNAME` | Utilisateur BDD | `pim` |
| `SPRING_DATASOURCE_PASSWORD` | Mot de passe BDD | `pim_local` |
| `PIM_MINIO_ENDPOINT` | Endpoint MinIO | `http://localhost:9000` |
| `PIM_CORS_ORIGINS` | Origines CORS autorisées | `http://localhost:3000` |
| `PIM_SWAGGER_ENABLED` | Activer Swagger UI | `true` |

### API

- Swagger UI : `http://localhost:8092/api/v1/swagger-ui.html`
- OpenAPI JSON : `http://localhost:8092/api/v1/api-docs`

## Sécurité

- Authentification JWT avec refresh tokens
- RBAC avec 16 permissions granulaires
- Rate limiting sur les endpoints d'authentification
- Verrouillage de compte après 5 tentatives échouées
- Validation MIME des uploads (whitelist)
- Headers de sécurité (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Conteneur Docker non-root

## Tests

```bash
cd backend
mvn test
```

50 tests unitaires couvrant les modules permissions, catalog et lifecycle.

## Stack technique

**Backend :** Spring Boot 3.4.1, Spring Security, Spring Modulith, Flyway, JPA/Hibernate, MinIO SDK, SpringDoc OpenAPI

**Frontend :** Next.js, React, TypeScript, Tailwind CSS

**Infrastructure :** PostgreSQL 16, MinIO, Docker Compose
