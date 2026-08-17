# Diagramme de Déploiement — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

---

## Vue d'ensemble de l'infrastructure

L'architecture de déploiement s'organise en couches avec un WAF ModSecurity comme point d'entrée, un backend Spring Boot sécurisé, et une infrastructure de services spécialisés (base de données, stockage objet, antivirus, KMS, monitoring).

```mermaid
graph TB
    subgraph clients["Postes clients"]
        BROWSER["Navigateur web<br/>React / Next.js"]
        SMARTPHONE["Application mobile<br/>Flutter (Android / iOS)"]
    end

    subgraph waf_layer["Point d entree securise"]
        WAF["WAF ModSecurity<br/>OWASP CRS v4<br/>Nginx Alpine<br/>port 8080"]
    end

    subgraph server["Serveur applicatif"]
        subgraph docker["Docker Compose"]
            SPRING["Spring Boot 3.4.1<br/>Java 21 (Alpine JRE)<br/>port 8092<br/>read-only filesystem"]
            NEXT["Next.js<br/>Node.js<br/>port 3000<br/>read-only filesystem"]
        end
    end

    subgraph data["Couche donnees"]
        PG[("PostgreSQL 18<br/>port 5432<br/>Base : pim_db")]
        RABBIT["RabbitMQ<br/>port 5672<br/>Management : 15672"]
        MINIO["MinIO<br/>port 9000<br/>Console : 9001<br/>Bucket : pim-media"]
    end

    subgraph security_infra["Infrastructure securite"]
        VAULT["HashiCorp Vault 1.17<br/>port 8200<br/>KMS / Secrets"]
        CLAMAV["ClamAV 1.3<br/>port 3310<br/>Scan antivirus"]
    end

    subgraph monitoring_infra["Stack monitoring"]
        PROM["Prometheus v2.53<br/>port 9090<br/>Retention 30j"]
        GRAFANA["Grafana 11.1<br/>port 3001<br/>Dashboards securite"]
        LOKI["Loki 3.1<br/>port 3100<br/>Aggregation logs"]
        PROMTAIL["Promtail 3.1<br/>Log shipper"]
    end

    subgraph external["Systemes externes Moov"]
        CRM["CRM Moov<br/>(API REST)"]
        CALLCENTER["Centre d appel<br/>(API REST)"]
        WEBSITE["Site web / e-boutique<br/>(API REST)"]
    end

    subgraph social["Reseaux sociaux"]
        FB["Facebook API"]
        IG["Instagram API"]
        LI["LinkedIn API"]
    end

    BROWSER -->|HTTPS :8080| WAF
    SMARTPHONE -->|HTTPS :8080| WAF
    WAF -->|HTTP :3000| NEXT
    WAF -->|HTTP :8092| SPRING
    NEXT -->|HTTP :8092| SPRING

    SPRING -->|JDBC :5432| PG
    SPRING -->|AMQP :5672| RABBIT
    SPRING -->|S3 API :9000| MINIO
    SPRING -->|Vault API :8200| VAULT
    SPRING -->|TCP :3310| CLAMAV

    SPRING -->|REST API| CRM
    SPRING -->|REST API| CALLCENTER
    SPRING -->|REST API| WEBSITE

    SPRING -->|REST API| FB
    SPRING -->|REST API| IG
    SPRING -->|REST API| LI

    SPRING -->|/actuator/prometheus| PROM
    PROM --> GRAFANA
    PROMTAIL --> LOKI
    LOKI --> GRAFANA
```

---

## Architecture réseau Docker

Trois réseaux isolés pour la défense en profondeur :

```mermaid
graph TB
    subgraph frontend_net["frontend-net (bridge)"]
        WAF_N["WAF<br/>ModSecurity"]
        NEXT_N["Next.js<br/>Frontend"]
        BACKEND_N1["Backend<br/>(interface frontend)"]
    end

    subgraph backend_net["backend-net (bridge, internal)"]
        BACKEND_N2["Backend<br/>(interface backend)"]
        PG_N["PostgreSQL"]
        MINIO_N["MinIO"]
        VAULT_N["Vault"]
        CLAMAV_N["ClamAV"]
        LOKI_N["Loki"]
        PROM_N["Prometheus"]
        PROMTAIL_N["Promtail"]
    end

    subgraph monitoring_net["monitoring-net (bridge)"]
        PROM_M["Prometheus"]
        GRAFANA_M["Grafana"]
        LOKI_M["Loki"]
        PROMTAIL_M["Promtail"]
    end
```

| Réseau | Type | Accès externe | Services |
|--------|------|--------------|----------|
| `frontend-net` | bridge | Oui (ports 8080, 3000) | WAF, Frontend, Backend |
| `backend-net` | bridge, **internal** | Non (aucun port exposé) | Backend, PostgreSQL, MinIO, Vault, ClamAV, Loki, Prometheus, Promtail |
| `monitoring-net` | bridge | Oui (ports 9090, 3001, 3100) | Prometheus, Grafana, Loki, Promtail |

**Principes de segmentation :**
- `backend-net` est marqué `internal: true` — aucun accès direct depuis l'extérieur. PostgreSQL, MinIO, Vault et ClamAV ne sont jamais exposés.
- Le WAF est le seul point d'entrée pour le trafic client. Il filtre via OWASP CRS v4 avant de proxifier vers le backend/frontend.
- Le backend a une interface sur les deux réseaux (frontend-net et backend-net) pour servir les clients et accéder aux services internes.

---

## Environnement de développement local

Toute l'infrastructure locale est containerisée via Docker Compose. Le backend Spring Boot et le frontend Next.js tournent en mode dev hors Docker (rechargement à chaud). Les services de sécurité (ClamAV, Vault, WAF) et de monitoring sont activables via des profils Docker Compose.

```mermaid
graph LR
    subgraph dev["Poste developpeur"]
        subgraph running["Processus en cours"]
            SB["spring-boot:run<br/>port 8092"]
            NX["next dev<br/>port 3000"]
        end
        subgraph containers["docker compose up"]
            PG_C["postgres:18-alpine<br/>port 5432"]
            RMQ_C["rabbitmq:3-management<br/>port 5672 / 15672"]
            MIN_C["minio/minio<br/>port 9000 / 9001"]
        end
        subgraph optional["docker compose --profile"]
            VAULT_C["vault (profile: vault)<br/>port 8200"]
            CLAM_C["clamav (profile: antivirus)<br/>port 3310"]
            WAF_C["waf (profile: waf)<br/>port 8080"]
            MON_C["monitoring (profile: monitoring)<br/>Prometheus + Grafana + Loki"]
            BAK_C["pg-backup (profile: backup)<br/>dump quotidien"]
        end
    end

    SB -->|JDBC| PG_C
    SB -->|AMQP| RMQ_C
    SB -->|S3| MIN_C
    NX -->|HTTP| SB
```

| Composant | Image / Version | Port | Données persistantes | Profil |
|-----------|----------------|------|---------------------|--------|
| PostgreSQL | `postgres:18-alpine` | 5432 | Volume `pim-pgdata` | (default) |
| RabbitMQ | `rabbitmq:3-management` | 5672 / 15672 | — | (default) |
| MinIO | `minio/minio` | 9000 / 9001 | Volume `pim-minio` | (default) |
| Spring Boot | Dev local (`mvn spring-boot:run`) | 8092 | — | — |
| Next.js | Dev local (`pnpm dev`) | 3000 | — | — |
| Flutter | Dev local (`flutter run`) | — | — | — |
| WAF ModSecurity | `owasp/modsecurity-crs:4-nginx-alpine` | 8080 | — | `waf` |
| ClamAV | `clamav/clamav:1.3` | 3310 | Volume `pim-clamav-data` | `antivirus` |
| HashiCorp Vault | `hashicorp/vault:1.17` | 8200 | Volume `pim-vault-data` | `vault` |
| Prometheus | `prom/prometheus:v2.53.0` | 9090 | Volume `pim-prometheus-data` | `monitoring` |
| Grafana | `grafana/grafana:11.1.0` | 3001 | Volume `pim-grafana-data` | `monitoring` |
| Loki | `grafana/loki:3.1.0` | 3100 | Volume `pim-loki-data` | `monitoring` |
| Promtail | `grafana/promtail:3.1.0` | — | — | `monitoring` |
| PG Backup | `postgres:18-alpine` | — | Volume `pim-backups` | `backup` |

---

## Schéma de migration (Flyway)

```
src/main/resources/db/migration/
├── V001__create_users_roles_permissions.sql
├── V002__create_categories.sql
├── V003__create_catalog_items.sql
├── V004__create_business_rules.sql
├── V005__create_offers.sql
├── V006__create_media_assets.sql
├── V007__create_ab_tests.sql
├── V008__create_campaigns.sql
├── V009__create_integration_exports.sql
├── V010__create_notifications.sql
├── V011__create_audit_logs.sql
├── V012__create_kpi_events.sql
├── V013__create_idempotency_keys.sql
├── V014__seed_roles_permissions.sql
├── V015__seed_admin_user.sql
├── V016__create_event_publication.sql
├── V017__add_catalog_write_permission.sql
├── V018__security_hardening.sql           ← Rate limiting, token versioning, audit enrichment
├── V019__add_mfa_and_audit_fields.sql     ← TOTP secret, MFA enabled, force password change
├── V020__add_gdpr_and_security_fields.sql ← anonymizedAt, account status ANONYMIZED
└── V021__create_webauthn_credentials.sql  ← Table webauthn_credentials (FIDO2/Passkeys)
```

**Stratégie JPA pour l'héritage CatalogItem** : `JOINED` — une table `catalog_items` (colonnes communes) + tables `products`, `services`, `packs` (colonnes spécifiques) liées par FK sur `id`. Choix justifié : pas de colonnes nullables inutiles (contrairement à SINGLE_TABLE), requêtes sur le type parent efficaces (contrairement à TABLE_PER_CLASS).

---

## Flux réseau et sécurité

```mermaid
graph LR
    CLIENT["Client<br/>(navigateur / mobile)"]
    WAF_S["WAF ModSecurity<br/>OWASP CRS v4<br/>Rate limiting<br/>Anti-DDoS"]
    API["API Spring Boot<br/>:8092"]
    DB[("PostgreSQL<br/>:5432")]
    VAULT_S["Vault KMS<br/>:8200"]

    CLIENT -->|"HTTPS<br/>via WAF :8080"| WAF_S
    WAF_S -->|"HTTP proxy<br/>Authorization: Bearer JWT"| API
    API -->|"JDBC<br/>SSL en prod"| DB
    API -->|"Vault API<br/>Cles de chiffrement"| VAULT_S

    subgraph jwt["Authentification JWT"]
        direction TB
        ACCESS["Access Token<br/>duree : 15 min<br/>+ fingerprint hash<br/>+ tokenVersion"]
        REFRESH["Refresh Token<br/>duree : 7 jours<br/>rotation a chaque usage<br/>hash SHA-256 en base"]
    end
```

| Couche | Mécanisme de sécurité |
|--------|----------------------|
| **WAF** | ModSecurity avec OWASP Core Rule Set v4. Paranoia niveau 2. Rate limiting (API 30r/s, auth 5r/min). Anti-scanner, anti-DDoS (slow loris, connection limits). Blocage auto après violations. |
| **Transport** | HTTPS obligatoire en production. HTTP autorisé uniquement en dev local. HSTS activé (max-age 1 an, includeSubDomains, preload). |
| **Authentification** | JWT stateless avec fingerprint binding et token versioning. Access token (15 min) + Refresh token (7 jours, rotation). Mot de passe hashé en bcrypt (cost 12). MFA TOTP (RFC 6238) + WebAuthn/FIDO2. MFA obligatoire pour ADMIN_SYSTEME. |
| **Autorisation** | @PreAuthorize deny-by-default. Filtre Spring Security vérifie le rôle (RoleName) et les permissions associées à chaque endpoint. |
| **Politique de mot de passe** | Min 12 caractères, majuscule, minuscule, chiffre, caractère spécial, vérification HIBP (k-anonymity SHA-1). Changement de mot de passe = révocation de tous les tokens. |
| **Chiffrement au repos** | AES-256-GCM via EncryptionService. Clé maître dans HashiCorp Vault. Secrets TOTP chiffrés en base. |
| **Chiffrement en transit** | TLS 1.2+ entre tous les composants en production. Monitoring certificats (CertificateMonitorScheduler, alertes à 30j et 7j). |
| **DLP** | Filtre DLP sur les réponses HTTP : détection de numéros de carte, SSN, emails en masse. Limite de taille des réponses (5 Mo). Limitation requêtes (200/min). |
| **Antivirus** | Scan ClamAV de chaque fichier uploadé avant stockage MinIO. Fichiers infectés rejetés (HTTP 422). |
| **Rotation des clés** | Clés de session : cycle 90 jours. Clé maître : cycle 365 jours. Vérification automatique hebdomadaire. Révocation d'urgence possible. |
| **Données** | Mots de passe jamais stockés en clair. Secrets (JWT secret, credentials MinIO/RabbitMQ) dans variables d'environnement, jamais dans le code ou le dépôt Git. PII masqués dans les logs (PiiMaskConverter). |
| **RGPD** | Export des données personnelles (GdprExportService). Anonymisation irréversible (DataAnonymizationService). Nettoyage automatique des données expirées (DataCleanupScheduler). |
| **Audit** | Chaque action sensible est tracée dans `audit_logs` (qui, quoi, quand, IP, valeur avant/après). Actions de sécurité auditées : login, MFA, changement de mot de passe, révocation, export RGPD, anonymisation. |
| **Monitoring** | Prometheus (métriques applicatives + sécurité), Grafana (dashboards), Loki (agrégation logs), Promtail (collecte logs). Alertes automatiques sur : login échoués, lockouts, MFA failures, malware détecté, certificats expirants. |
| **Idempotence** | Clé d'idempotence sur les exports pour éviter les doublons en cas de retry. |
| **Conteneurs** | Filesystem read-only, tmpfs pour /tmp et /app/logs, no-new-privileges, limites mémoire/CPU, images Alpine. |
| **Headers de sécurité** | CSP (`default-src 'none'`), X-Content-Type-Options, X-Frame-Options (DENY), Referrer-Policy, Permissions-Policy. |

---

## Sécurisation des conteneurs Docker

| Mesure | Application |
|--------|-------------|
| **Read-only filesystem** | `read_only: true` sur backend et frontend. Seuls `/tmp` et `/app/logs` sont en tmpfs (noexec, nosuid). |
| **No new privileges** | `security_opt: no-new-privileges:true` sur tous les conteneurs. |
| **Limites de ressources** | Mémoire et CPU limités par conteneur (ex. backend 1G/2CPU, PostgreSQL 512M/1CPU). |
| **Images minimales** | Images Alpine pour PostgreSQL, Vault, WAF. JRE Alpine pour le backend (multi-stage build). |
| **Réseau interne** | `backend-net` marqué `internal: true` — aucun port exposé vers l'extérieur. |
| **Healthchecks** | Healthcheck configuré sur chaque service critique (PostgreSQL, MinIO, Vault, ClamAV). |
| **Backup automatique** | pg_dump quotidien avec rétention 7 jours (profil `backup`). |

---

## CI/CD (GitHub Actions)

| Étape | Outil | Description |
|-------|-------|-------------|
| **Build** | Maven + JDK 21 | Compilation, tests unitaires, packaging |
| **SAST** | CodeQL, SpotBugs | Analyse statique du code source |
| **SCA** | OWASP Dependency-Check | Scan des dépendances (CVE) |
| **DAST** | OWASP ZAP | Scan dynamique de l'API déployée |
| **Secret scanning** | Gitleaks | Détection de secrets dans le code |
| **SBOM** | CycloneDX Maven Plugin | Génération du Software Bill of Materials |
| **Container signing** | Cosign (Sigstore) | Signature cryptographique des images Docker |
| **Container scan** | Trivy | Scan de vulnérabilités des images Docker |

---

## Contraintes de déploiement pour la soutenance

| Contrainte | Décision |
|-----------|----------|
| Pas d'accès aux systèmes réels de Moov (CRM, centre d'appel, site web) | Les connecteurs `integration` utilisent des **mocks/stubs** qui simulent les réponses. Documenté clairement dans le mémoire comme "simulé". |
| Pas de serveur de production | Démonstration en local (docker-compose + dev servers). |
| Dépôt sur GitHub personnel | Aucune donnée de production, aucun secret, aucune credential réelle dans le dépôt. |
| Flutter non encore installé | Le mobile est modélisé et conçu (maquettes, architecture), implémenté si le temps le permet. |
| Services optionnels via profils | ClamAV, Vault, WAF et monitoring sont activables via `--profile` pour ne pas surcharger la machine de développement. |
