# Diagramme de Composants — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

---

## Architecture modulaire (Spring Modulith)

Le backend est organisé en **monolithe modulaire** avec Spring Modulith. Chaque module expose une API publique (`*Api`) et communique avec les autres exclusivement via des événements Spring ou des interfaces publiques. Aucun accès direct aux classes `internal` d'un autre module.

```mermaid
graph TB
    subgraph frontend["Clients"]
        WEB["React / Next.js<br/>(port 3000)"]
        MOBILE["Flutter / Riverpod<br/>(Android / iOS)"]
    end

    subgraph waf_layer["Couche WAF"]
        WAF["WAF ModSecurity<br/>OWASP CRS v4<br/>(port 8080)"]
    end

    API["API REST Gateway<br/>/api/v1/*<br/>Spring Boot 3.4.1<br/>Java 21"]

    WEB -->|HTTPS / JSON| WAF
    MOBILE -->|HTTPS / JSON| WAF
    WAF -->|HTTP proxy| API

    subgraph modulith["Spring Modulith — com.moov.pim"]
        direction TB

        subgraph core["Modules coeur"]
            AUTH["permissions<br/>Auth + JWT + MFA<br/>+ WebAuthn + Roles"]
            CATALOG["catalog<br/>Product, Service,<br/>Pack, Category"]
            RULES["rules<br/>BusinessRule,<br/>validation assemblage"]
            LIFECYCLE["lifecycle<br/>Offer, OfferItem,<br/>workflow statuts"]
        end

        subgraph content["Modules contenu"]
            DAM["dam<br/>MediaAsset, MinIO,<br/>conformité, ClamAV"]
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

        subgraph shared_module["Module transversal (shared)"]
            SECURITY["security<br/>DlpFilter, EncryptionService,<br/>SecurityMetrics, PiiMask"]
            GDPR["gdpr<br/>GdprExport, Anonymization,<br/>DataCleanup"]
            MONITORING["monitoring<br/>CertificateMonitor,<br/>KeyRotation scheduler"]
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
        DB[("PostgreSQL 16")]
        MQ["RabbitMQ"]
        S3["MinIO (S3)"]
        VAULT["HashiCorp Vault<br/>KMS / Secrets"]
        CLAMAV_SVC["ClamAV<br/>Antivirus"]
    end

    subgraph monitoring_stack["Stack Monitoring"]
        PROMETHEUS["Prometheus"]
        GRAFANA["Grafana"]
        LOKI["Loki"]
        PROMTAIL["Promtail"]
    end

    AUTH -->|JDBC| DB
    CATALOG -->|JDBC| DB
    RULES -->|JDBC| DB
    LIFECYCLE -->|JDBC| DB
    DAM -->|JDBC| DB
    DAM -->|S3 API| S3
    DAM -->|TCP :3310| CLAMAV_SVC
    WORKFLOW -->|JDBC| DB
    NOTIF -->|JDBC| DB
    ANALYTICS -->|JDBC| DB
    INTEGRATION -->|JDBC| DB
    CAMPAIGN -->|JDBC| DB

    SECURITY -->|Vault API| VAULT
    MONITORING -->|TCP/SSL| API

    LIFECYCLE -->|events| MQ
    INTEGRATION -->|events| MQ
    CAMPAIGN -->|events| MQ
    NOTIF -->|events| MQ
    DAM -->|events| MQ

    API -->|/actuator/prometheus| PROMETHEUS
    PROMETHEUS --> GRAFANA
    PROMTAIL --> LOKI
    LOKI --> GRAFANA
```

---

## Détail des modules et de leurs responsabilités

| Module | Package | Responsabilités | Dépendances internes |
|--------|---------|-----------------|---------------------|
| **permissions** | `com.moov.pim.permissions` | Authentification JWT (access + refresh, fingerprint binding, token versioning), MFA TOTP (RFC 6238) + WebAuthn/FIDO2, gestion des utilisateurs, rôles, permissions, verrouillage de compte (5 échecs), politique de mot de passe (min 12 chars, HIBP k-anonymity), MfaPolicyFilter (MFA obligatoire pour ADMIN_SYSTEME), KeyManagementService (rotation clés, révocation d'urgence). | shared.security (EncryptionService, DlpFilter, SecurityMetrics) |
| **catalog** | `com.moov.pim.catalog` | CRUD Product, Service, Pack, Category. Détection doublons. Score qualité. | permissions (vérification droits) |
| **rules** | `com.moov.pim.rules` | CRUD BusinessRule. Validation automatique à l'assemblage d'une offre. | catalog (lecture des CatalogItems) |
| **lifecycle** | `com.moov.pim.lifecycle` | CRUD Offer, OfferItem. Machine à états (10 statuts). Versioning + rollback. Scheduler (publication planifiée, expiration). | catalog (lecture items), rules (validation), permissions (visibilité CdP) |
| **dam** | `com.moov.pim.dam` | Stockage MinIO, CRUD MediaAsset, OfferMedia. Vérification conformité automatique. Scan antivirus ClamAV avant stockage. | permissions, shared.security |
| **workflow** | `com.moov.pim.workflow` | Validation graphique (MediaValidation). Circuit indépendant du lifecycle. | dam (lecture médias), permissions |
| **ai-content** | `com.moov.pim.aicontent` | Génération de descriptions marketing SEO (courte, longue). Test A/B. | catalog (caractéristiques), lifecycle (offre) |
| **ai-tagging** | `com.moov.pim.aitagging` | Auto-tagging, extraction de données depuis fiches techniques. | catalog |
| **integration** | `com.moov.pim.integration` | Export automatique vers CRM, centre d'appel, site web. Idempotence. Retry avec backoff. | lifecycle (événement publication) |
| **campaign** | `com.moov.pim.campaign` | Campagnes CM vers réseaux sociaux et partenaires. Statistiques. | lifecycle (offre publiée), permissions |
| **notification** | `com.moov.pim.notification` | Envoi de notifications in-app. Configuration des canaux par l'admin. | permissions (destinataires) |
| **analytics** | `com.moov.pim.analytics` | KpiEvent, calcul Time To Market, productivité par étape. Configuration indicateurs. | lifecycle (événements), permissions (droits CdD) |
| **shared.security** | `com.moov.pim.shared.security` | DlpFilter (détection exfiltration données), EncryptionService (AES-256-GCM, clé Vault), SecurityMetricsService (métriques Prometheus), PiiMaskConverter (masquage PII Logback). | — (module transversal, sans dépendances internes) |
| **shared.gdpr** | `com.moov.pim.shared.gdpr` | GdprExportService (export données personnelles JSON), DataAnonymizationService (anonymisation irréversible PII), DataCleanupScheduler (nettoyage TTL). | permissions (accès utilisateurs) |
| **shared.monitoring** | `com.moov.pim.shared.scheduler` | CertificateMonitorScheduler (vérification expiration TLS quotidienne), alertes WARNING (30j) et CRITICAL (7j). | — |

---

## Composants de sécurité du module permissions

```mermaid
graph TB
    subgraph permissions["com.moov.pim.permissions"]
        subgraph security_pkg["security"]
            JWT_FILTER["JwtAuthenticationFilter<br/>Extraction + validation JWT<br/>+ fingerprint check"]
            RATE_FILTER["RateLimitFilter<br/>Limitation par IP/endpoint"]
            MFA_FILTER["MfaPolicyFilter<br/>MFA obligatoire ADMIN"]
            SEC_CONFIG["SecurityConfig<br/>CORS, CSP, HSTS,<br/>chaîne de filtres"]
            JWT_PROVIDER["JwtTokenProvider<br/>Génération/validation JWT<br/>fingerprint, tokenVersion"]
            PWD_POLICY["PasswordPolicyService<br/>Min 12 chars, complexité,<br/>HIBP k-anonymity"]
            USER_DETAILS["CustomUserDetailsService<br/>Chargement user + rôle"]
        end

        subgraph service_pkg["service"]
            AUTH_SVC["AuthService<br/>Login, register, refresh,<br/>logout, changePassword"]
            TOTP_SVC["TotpService<br/>TOTP RFC 6238<br/>generateSecret, verify"]
            WEBAUTHN_SVC["WebAuthnService<br/>FIDO2 registration,<br/>authentication"]
            KEY_MGMT["KeyManagementService<br/>Rotation clés, révocation<br/>d urgence, compliance"]
        end

        subgraph api_pkg["api"]
            AUTH_CTRL["AuthController<br/>/auth/*"]
            KEY_CTRL["KeyManagementController<br/>/admin/keys/*<br/>@PreAuthorize ADMIN"]
        end
    end

    SEC_CONFIG --> JWT_FILTER
    SEC_CONFIG --> RATE_FILTER
    SEC_CONFIG --> MFA_FILTER
    AUTH_CTRL --> AUTH_SVC
    AUTH_SVC --> TOTP_SVC
    AUTH_SVC --> WEBAUTHN_SVC
    AUTH_SVC --> PWD_POLICY
    AUTH_SVC --> JWT_PROVIDER
    KEY_CTRL --> KEY_MGMT
```

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
    SECURITY["shared.security"]

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
    DAM -.->|scan antivirus| SECURITY
```

**Conventions :**
- **Trait plein (-->)** : communication asynchrone via événements Spring / RabbitMQ (couplage faible)
- **Trait pointillé (-..->)** : appel synchrone via l'API publique du module (couplage contrôlé)
- Jamais d'accès direct aux classes `internal` d'un autre module

---

## Chaîne de filtres de sécurité (SecurityFilterChain)

Ordre d'exécution des filtres Spring Security pour chaque requête HTTP entrante :

```mermaid
graph LR
    REQ["Requête HTTP"] --> CORS["CorsFilter"]
    CORS --> RATE["RateLimitFilter"]
    RATE --> JWT["JwtAuthenticationFilter"]
    JWT --> AUTH["UsernamePasswordAuthenticationFilter"]
    AUTH --> MFA["MfaPolicyFilter"]
    MFA --> AUTHZ["AuthorizationFilter<br/>@PreAuthorize"]
    AUTHZ --> DLP["DlpFilter<br/>(réponse)"]
    DLP --> RESP["Réponse HTTP"]
```

| Filtre | Rôle | Position |
|--------|------|----------|
| `CorsFilter` | Validation des origines autorisées | Premier (Spring Security) |
| `RateLimitFilter` | Limitation de débit par IP et endpoint | Avant authentification |
| `JwtAuthenticationFilter` | Extraction du JWT, validation signature + expiration + tokenVersion + fingerprint | Avant authentification |
| `MfaPolicyFilter` | Bloque les ADMIN_SYSTEME sans MFA activé (HTTP 403 MFA_REQUIRED_FOR_ADMIN) | Après authentification |
| `AuthorizationFilter` | Vérification @PreAuthorize deny-by-default | Après MFA |
| `DlpFilter` | Détection de fuites de données dans les réponses (numéros de carte, emails en masse) | Après autorisation (sur la réponse) |

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
