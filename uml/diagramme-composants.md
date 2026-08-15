# Diagramme de Composants — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

---

## Architecture modulaire (Spring Modulith)

Le backend est organisé en **monolithe modulaire** avec Spring Modulith. Chaque module expose une API publique (`*Api`) et communique avec les autres exclusivement via des événements Spring ou des interfaces publiques. Aucun accès direct aux classes `internal` d'un autre module.

```mermaid
graph TB
    subgraph frontend["Clients"]
        WEB["React / Next.js<br/>(port 3002)"]
        MOBILE["Flutter / Riverpod<br/>(Android / iOS)"]
    end

    API["API REST Gateway<br/>/api/v1/*<br/>Spring Boot 4.1.x"]

    WEB -->|HTTPS / JSON| API
    MOBILE -->|HTTPS / JSON| API

    subgraph modulith["Spring Modulith — com.moov.pim"]
        direction TB

        subgraph core["Modules coeur"]
            AUTH["permissions<br/>Auth + JWT + Roles"]
            CATALOG["catalog<br/>Product, Service,<br/>Pack, Category"]
            RULES["rules<br/>BusinessRule,<br/>validation assemblage"]
            LIFECYCLE["lifecycle<br/>Offer, OfferItem,<br/>workflow statuts"]
        end

        subgraph content["Modules contenu"]
            DAM["dam<br/>MediaAsset, MinIO,<br/>conformité"]
            WORKFLOW["workflow<br/>Validation graphique,<br/>MediaValidation"]
            AI_CONTENT["ai-content<br/>Génération descriptions<br/>marketing SEO"]
            AI_TAG["ai-tagging<br/>Auto-tagging,<br/>extraction données"]
        end

        subgraph distribution["Modules diffusion"]
            INTEGRATION["integration<br/>Export CRM, centre<br/>d appel, site web"]
            CAMPAIGN["campaign<br/>Campaign, réseaux<br/>sociaux, partenaires"]
        end

        subgraph support["Modules support"]
            NOTIF["notification<br/>Notification,<br/>NotificationConfig"]
            ANALYTICS["analytics<br/>KpiEvent, KpiConfig,<br/>Time To Market"]
        end
    end

    API --> AUTH
    API --> CATALOG
    API --> RULES
    API --> LIFECYCLE
    API --> DAM
    API --> WORKFLOW
    API --> AI_CONTENT
    API --> AI_TAG
    API --> INTEGRATION
    API --> CAMPAIGN
    API --> NOTIF
    API --> ANALYTICS

    subgraph infra["Infrastructure"]
        DB[("PostgreSQL 18.4")]
        MQ["RabbitMQ"]
        S3["MinIO (S3)"]
    end

    AUTH -->|JDBC| DB
    CATALOG -->|JDBC| DB
    RULES -->|JDBC| DB
    LIFECYCLE -->|JDBC| DB
    DAM -->|JDBC| DB
    DAM -->|S3 API| S3
    WORKFLOW -->|JDBC| DB
    NOTIF -->|JDBC| DB
    ANALYTICS -->|JDBC| DB
    INTEGRATION -->|JDBC| DB
    CAMPAIGN -->|JDBC| DB

    LIFECYCLE -->|events| MQ
    INTEGRATION -->|events| MQ
    CAMPAIGN -->|events| MQ
    NOTIF -->|events| MQ
    DAM -->|events| MQ
```

---

## Détail des modules et de leurs responsabilités

| Module | Package | Responsabilités | Dépendances internes |
|--------|---------|-----------------|---------------------|
| **permissions** | `com.moov.pim.permissions` | Authentification JWT, gestion des utilisateurs, rôles, permissions, verrouillage de compte | Aucune (module racine) |
| **catalog** | `com.moov.pim.catalog` | CRUD Product, Service, Pack, Category. Détection doublons. Score qualité. | permissions (vérification droits) |
| **rules** | `com.moov.pim.rules` | CRUD BusinessRule. Validation automatique à l'assemblage d'une offre. | catalog (lecture des CatalogItems) |
| **lifecycle** | `com.moov.pim.lifecycle` | CRUD Offer, OfferItem. Machine à états (10 statuts). Versioning + rollback. Scheduler (publication planifiée, expiration). | catalog (lecture items), rules (validation), permissions (visibilité CdP) |
| **dam** | `com.moov.pim.dam` | Stockage MinIO, CRUD MediaAsset, OfferMedia. Vérification conformité automatique. | permissions |
| **workflow** | `com.moov.pim.workflow` | Validation graphique (MediaValidation). Circuit indépendant du lifecycle. | dam (lecture médias), permissions |
| **ai-content** | `com.moov.pim.aicontent` | Génération de descriptions marketing SEO (courte, longue). Test A/B. | catalog (caractéristiques), lifecycle (offre) |
| **ai-tagging** | `com.moov.pim.aitagging` | Auto-tagging, extraction de données depuis fiches techniques. | catalog |
| **integration** | `com.moov.pim.integration` | Export automatique vers CRM, centre d'appel, site web. Idempotence. Retry avec backoff. | lifecycle (événement publication) |
| **campaign** | `com.moov.pim.campaign` | Campagnes CM vers réseaux sociaux et partenaires. Statistiques. | lifecycle (offre publiée), permissions |
| **notification** | `com.moov.pim.notification` | Envoi de notifications in-app. Configuration des canaux par l'admin. | permissions (destinataires) |
| **analytics** | `com.moov.pim.analytics` | KpiEvent, calcul Time To Market, productivité par étape. Configuration indicateurs. | lifecycle (événements), permissions (droits CdD) |

---

## Communication inter-modules

```mermaid
graph LR
    LIFECYCLE["lifecycle"]
    CATALOG["catalog"]
    RULES["rules"]
    DAM["dam"]
    WORKFLOW["workflow"]
    INTEGRATION["integration"]
    CAMPAIGN["campaign"]
    NOTIF["notification"]
    ANALYTICS["analytics"]

    LIFECYCLE -->|OfferCreatedEvent| NOTIF
    LIFECYCLE -->|OfferSubmittedEvent| NOTIF
    LIFECYCLE -->|OfferValidatedEvent| NOTIF
    LIFECYCLE -->|OfferPublishedEvent| INTEGRATION
    LIFECYCLE -->|OfferPublishedEvent| CAMPAIGN
    LIFECYCLE -->|OfferPublishedEvent| NOTIF
    LIFECYCLE -->|OfferRejectedEvent| NOTIF
    LIFECYCLE -->|OfferStatusChangedEvent| ANALYTICS
    DAM -->|MediaUploadedEvent| WORKFLOW
    DAM -->|MediaNonCompliantEvent| NOTIF
    CAMPAIGN -->|CampaignPublishedEvent| ANALYTICS

    LIFECYCLE -.->|appel synchrone| RULES
    LIFECYCLE -.->|appel synchrone| CATALOG
    LIFECYCLE -.->|appel synchrone| DAM
```

**Conventions :**
- **Trait plein (-->)** : communication asynchrone via événements Spring / RabbitMQ (couplage faible)
- **Trait pointillé (-..->)** : appel synchrone via l'API publique du module (couplage contrôlé)
- Jamais d'accès direct aux classes `internal` d'un autre module

---

## Structure de dossiers d'un module (convention)

```
com.moov.pim.lifecycle/
├── LifecycleApi.java              # Interface publique du module
├── event/
│   ├── OfferCreatedEvent.java
│   ├── OfferPublishedEvent.java
│   └── OfferStatusChangedEvent.java
├── spi/                           # Interfaces pour dépendances externes
│   └── CatalogItemProvider.java
└── internal/
    ├── domain/
    │   ├── Offer.java
    │   ├── OfferItem.java
    │   ├── OfferVersion.java
    │   └── OfferStatusHistory.java
    ├── dto/
    │   ├── CreateOfferRequest.java
    │   └── OfferResponse.java
    ├── repository/
    │   └── OfferRepository.java
    ├── service/
    │   └── OfferService.java
    └── web/
        └── OfferController.java
```
