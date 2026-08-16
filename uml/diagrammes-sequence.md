# Diagrammes de Séquence — PIM Moov Africa Burkina Faso

> **Phase 1 — Analyse et modélisation UML**
> Licence 3 SIR — Koussoube Drissa — Encadrant académique : M. Tindano Olivier

---

## Table des matières

1. [Création d'une offre](#1-création-dune-offre)
2. [Enrichissement par l'analyste marketing](#2-enrichissement-par-lanalyste-marketing)
3. [Circuit de validation complet](#3-circuit-de-validation-complet)
4. [Rejet et correction](#4-rejet-et-correction)
5. [Validation graphique (circuit dédié)](#5-validation-graphique-circuit-dédié)
6. [Publication et diffusion automatique](#6-publication-et-diffusion-automatique)
7. [Publication planifiée et expiration automatique](#7-publication-planifiée-et-expiration-automatique)
8. [Rollback d'une offre par l'administrateur](#8-rollback-dune-offre-par-ladministrateur)
9. [Authentification (login avec MFA et fingerprint)](#9-authentification-login-avec-mfa-et-fingerprint)
10. [Création d'un produit avec détection de doublons](#10-création-dun-produit-avec-détection-de-doublons)
11. [Campagne de diffusion réseaux sociaux (Community Manager)](#11-campagne-de-diffusion-réseaux-sociaux-community-manager)
12. [Configuration MFA TOTP](#12-configuration-mfa-totp)
13. [Enregistrement d'une Passkey WebAuthn](#13-enregistrement-dune-passkey-webauthn)
14. [Changement de mot de passe (avec politique de sécurité)](#14-changement-de-mot-de-passe-avec-politique-de-sécurité)
15. [Rotation des clés et révocation d'urgence](#15-rotation-des-clés-et-révocation-durgence)
16. [Upload de fichier avec scan antivirus ClamAV](#16-upload-de-fichier-avec-scan-antivirus-clamav)

---

## 1. Création d'une offre

Le chef de produit crée une offre à partir de produits/packs existants du catalogue. Le système vérifie les règles métier, crée la fiche et notifie l'analyste marketing.

```mermaid
sequenceDiagram
    actor CdP as Chef de produit
    participant API as API REST
    participant OfferSvc as OfferService
    participant RuleSvc as RuleService
    participant DB as PostgreSQL
    participant Queue as RabbitMQ
    participant NotifSvc as NotificationService
    actor AM as Analyste marketing

    CdP->>API: POST /api/v1/offers (name, items[], description)
    API->>OfferSvc: createOffer(dto, userId)
    OfferSvc->>RuleSvc: validateRules(items[])

    alt Regles non respectees
        RuleSvc-->>OfferSvc: RuleViolationException
        OfferSvc-->>API: 422 Unprocessable Entity
        API-->>CdP: Erreur : regles violees (detail)
    else Regles OK
        RuleSvc-->>OfferSvc: OK
        OfferSvc->>DB: INSERT offer (status=DRAFT)
        OfferSvc->>DB: INSERT offer_items
        OfferSvc->>DB: INSERT offer_version (v1, snapshot)
        OfferSvc->>DB: INSERT offer_status_history (null -> DRAFT)
        OfferSvc->>DB: INSERT audit_log (CREATE, offer)
        DB-->>OfferSvc: OK
        OfferSvc->>Queue: OfferCreatedEvent
        Queue->>NotifSvc: consume OfferCreatedEvent
        NotifSvc->>DB: INSERT notification (AM, ENRICHMENT_REQUIRED)
        NotifSvc-->>AM: Notification : offre en attente d'enrichissement
        OfferSvc-->>API: 201 Created (offerDto)
        API-->>CdP: Offre creee (status=DRAFT)
    end
```

---

## 2. Enrichissement par l'analyste marketing

L'analyste marketing enrichit la fiche (descriptions marketing, SEO, visuels) sur la même fiche que celle créée par le chef de produit.

```mermaid
sequenceDiagram
    actor AM as Analyste marketing
    participant API as API REST
    participant OfferSvc as OfferService
    participant AISvc as AIContentService
    participant DAM as DAM / MinIO
    participant DB as PostgreSQL

    AM->>API: GET /api/v1/offers/{id}
    API-->>AM: Fiche offre (status=DRAFT)

    AM->>API: PATCH /api/v1/offers/{id}/enrich (descriptions, SEO)
    API->>OfferSvc: enrichOffer(id, dto, userId)
    OfferSvc->>DB: UPDATE offer (status=IN_ENRICHMENT)
    OfferSvc->>DB: INSERT offer_version (v2, snapshot)
    OfferSvc->>DB: INSERT offer_status_history (DRAFT -> IN_ENRICHMENT)
    DB-->>OfferSvc: OK

    opt Generation IA demandee
        AM->>API: POST /api/v1/offers/{id}/generate-content
        API->>AISvc: generateDescriptions(characteristics)
        AISvc-->>API: shortDesc, longDesc, seoTitle, seoDesc
        API-->>AM: Contenu genere (a valider par AM)
    end

    opt Upload de medias
        AM->>API: POST /api/v1/offers/{id}/media (fichier)
        API->>DAM: store(file)
        DAM-->>API: storageKey
        API->>DB: INSERT media_asset + offer_media
        API->>DB: INSERT media_asset (conformityStatus=PENDING)
        API-->>AM: Media associe a la fiche
    end

    OfferSvc-->>API: 200 OK
    API-->>AM: Fiche enrichie
```

---

## 3. Circuit de validation complet

Après enrichissement, le chef de produit soumet l'offre. Le chef de service fait la validation opérationnelle, puis le chef de département fait la validation stratégique et décide de publier.

```mermaid
sequenceDiagram
    actor CdP as Chef de produit
    participant API as API REST
    participant OfferSvc as OfferService
    participant DB as PostgreSQL
    participant Queue as RabbitMQ
    participant NotifSvc as NotificationService
    actor CdS as Chef de service
    actor CdD as Chef de departement

    Note over CdP,CdD: Phase 1 : Soumission par le Chef de produit
    CdP->>API: POST /api/v1/offers/{id}/submit
    API->>OfferSvc: submitForValidation(id, userId)
    OfferSvc->>DB: UPDATE offer (status=IN_VALIDATION)
    OfferSvc->>DB: INSERT offer_status_history
    OfferSvc->>Queue: OfferSubmittedEvent
    Queue->>NotifSvc: consume
    NotifSvc->>DB: INSERT notification (CdS, VALIDATION_REQUIRED)
    NotifSvc-->>CdS: Notification : offre a valider
    API-->>CdP: Offre soumise

    Note over CdP,CdD: Phase 2 : Validation operationnelle (Chef de service)
    CdS->>API: GET /api/v1/offers/{id}
    API-->>CdS: Fiche complete + medias
    CdS->>API: POST /api/v1/offers/{id}/validate (comment)
    API->>OfferSvc: validateOffer(id, userId, comment)
    OfferSvc->>DB: UPDATE offer (status=VALIDATED)
    OfferSvc->>DB: INSERT offer_status_history
    OfferSvc->>DB: INSERT audit_log (VALIDATE)
    OfferSvc->>Queue: OfferValidatedEvent
    Queue->>NotifSvc: consume
    NotifSvc->>DB: INSERT notification (CdD, STRATEGIC_VALIDATION)
    NotifSvc-->>CdD: Notification : validation strategique requise
    API-->>CdS: Offre validee

    Note over CdP,CdD: Phase 3 : Validation strategique (Chef de departement)
    CdD->>API: GET /api/v1/offers/{id}
    API-->>CdD: Fiche + mentions legales
    CdD->>API: POST /api/v1/offers/{id}/publish
    API->>OfferSvc: publishOffer(id, userId)
    OfferSvc->>DB: UPDATE offer (status=PUBLISHED)
    OfferSvc->>DB: INSERT offer_status_history
    OfferSvc->>DB: INSERT audit_log (PUBLISH)
    DB-->>OfferSvc: OK
    API-->>CdD: Offre publiee
```

---

## 4. Rejet et correction

Le chef de service rejette l'offre avec un commentaire obligatoire. Le chef de produit est notifié, corrige et resoumet.

```mermaid
sequenceDiagram
    actor CdS as Chef de service
    participant API as API REST
    participant OfferSvc as OfferService
    participant DB as PostgreSQL
    participant Queue as RabbitMQ
    participant NotifSvc as NotificationService
    actor CdP as Chef de produit

    CdS->>API: POST /api/v1/offers/{id}/reject (comment obligatoire)
    API->>OfferSvc: rejectOffer(id, userId, comment)
    OfferSvc->>DB: UPDATE offer (status=DRAFT)
    OfferSvc->>DB: INSERT offer_status_history (IN_VALIDATION -> DRAFT, comment)
    OfferSvc->>DB: INSERT audit_log (REJECT)
    OfferSvc->>Queue: OfferRejectedEvent
    Queue->>NotifSvc: consume
    NotifSvc->>DB: INSERT notification (CdP, OFFER_REJECTED)
    NotifSvc-->>CdP: Notification : offre rejetee + motif
    API-->>CdS: Offre rejetee

    Note over CdP: Le CdP corrige et resoumet
    CdP->>API: PATCH /api/v1/offers/{id} (corrections)
    API->>OfferSvc: updateOffer(id, dto, userId)
    OfferSvc->>DB: UPDATE offer
    OfferSvc->>DB: INSERT offer_version (snapshot)
    DB-->>OfferSvc: OK
    API-->>CdP: Offre corrigee

    CdP->>API: POST /api/v1/offers/{id}/submit
    API->>OfferSvc: submitForValidation(id, userId)
    OfferSvc->>DB: UPDATE offer (status=IN_VALIDATION)
    OfferSvc->>DB: INSERT offer_status_history (DRAFT -> IN_VALIDATION)
    OfferSvc->>Queue: OfferSubmittedEvent
    Queue->>NotifSvc: consume
    NotifSvc-->>CdS: Notification : offre resoumise
    API-->>CdP: Offre resoumise
```

---

## 5. Validation graphique (circuit dédié)

Circuit indépendant de la validation métier. L'analyste marketing dépose les visuels, le système vérifie automatiquement la conformité (résolution, format, droits d'auteur), puis le chef de service annote et valide ou rejette chaque média. Ce circuit se déroule **en parallèle** de l'enrichissement et doit être terminé AVANT que l'offre ne puisse passer en EN_VALIDATION.

```mermaid
sequenceDiagram
    actor AM as Analyste marketing
    participant API as API REST
    participant DAM as DAM / MinIO
    participant ConformSvc as ConformityService
    participant DB as PostgreSQL
    participant Queue as RabbitMQ
    participant NotifSvc as NotificationService
    actor CdS as Chef de service

    Note over AM,CdS: Phase 1 : Depot et verification automatique

    AM->>API: POST /api/v1/offers/{offerId}/media (fichier)
    API->>DAM: store(file)
    DAM-->>API: storageKey
    API->>DB: INSERT media_asset (conformityStatus=PENDING)
    API->>DB: INSERT offer_media (offerId, mediaAssetId)
    API->>Queue: MediaUploadedEvent

    Queue->>ConformSvc: consume MediaUploadedEvent
    ConformSvc->>DAM: getMetadata(storageKey)
    DAM-->>ConformSvc: width, height, resolution, mimeType

    alt Resolution ou format non conforme
        ConformSvc->>DB: UPDATE media_asset (conformityStatus=NON_COMPLIANT)
        ConformSvc->>Queue: MediaNonCompliantEvent
        Queue->>NotifSvc: consume
        NotifSvc-->>AM: Notification : media non conforme (details)
    else Risque droits auteur detecte
        ConformSvc->>DB: UPDATE media_asset (conformityStatus=COMPLIANT, copyrightRisk=true)
        ConformSvc->>Queue: MediaCopyrightRiskEvent
        Queue->>NotifSvc: consume
        NotifSvc-->>AM: Avertissement : risque droits auteur
    else Conforme
        ConformSvc->>DB: UPDATE media_asset (conformityStatus=COMPLIANT)
    end

    API-->>AM: Media uploade (statut conformite)

    Note over AM,CdS: Phase 2 : Correction si non conforme

    opt Media NON_COMPLIANT
        AM->>API: DELETE /api/v1/media/{id}
        AM->>API: POST /api/v1/offers/{offerId}/media (nouveau fichier)
        Note over API,ConformSvc: Meme cycle de verification
    end

    Note over AM,CdS: Phase 3 : Validation graphique par le Chef de service

    AM->>API: POST /api/v1/offers/{offerId}/submit-media
    API->>Queue: MediaSubmittedForValidationEvent
    Queue->>NotifSvc: consume
    NotifSvc-->>CdS: Notification : medias a valider

    CdS->>API: GET /api/v1/offers/{offerId}/media
    API-->>CdS: Liste des medias avec conformite

    loop Pour chaque media
        CdS->>API: POST /api/v1/media/{id}/validate (status, annotation)
        API->>DB: INSERT media_validation (status, annotation, validatedById)

        alt Media rejete
            API->>Queue: MediaRejectedEvent
            Queue->>NotifSvc: consume
            NotifSvc-->>AM: Notification : media rejete + annotation
        end
    end

    Note over AM,CdS: Si rejet : AM corrige et redepose, meme circuit

    opt Tous les medias approuves
        Note over API: L offre peut maintenant etre soumise en validation metier
    end
```

**Articulation avec le circuit de validation métier :**
- La validation graphique et l'enrichissement de contenu se déroulent en parallèle pendant la phase EN_ENRICHISSEMENT.
- Lors de la soumission (EN_ENRICHISSEMENT -> EN_VALIDATION), le système vérifie que **tous les médias sont conformes** et qu'**aucune MediaValidation n'est en statut REJECTED**.
- Si cette condition n'est pas remplie, la soumission est bloquée avec un message explicite.

---

## 6. Publication et diffusion automatique

À la publication, le système diffuse **automatiquement** la fiche vers CRM, centre d'appel et site web (bloc 1 — diffusion automatique). Le Community Manager est notifié pour préparer ses campagnes (bloc 2 — voir diagramme 11).

```mermaid
sequenceDiagram
    participant OfferSvc as OfferService
    participant Queue as RabbitMQ
    participant IntSvc as IntegrationService
    participant DB as PostgreSQL
    participant CRM as CRM (externe)
    participant CallCenter as Centre d'appel (externe)
    participant Website as Site web (externe)
    participant NotifSvc as NotificationService
    actor CM as Community Manager

    Note over OfferSvc,CM: Declenchement : offre passe en status PUBLISHED

    OfferSvc->>Queue: OfferPublishedEvent
    
    par Diffusion vers CRM
        Queue->>IntSvc: consume (target=CRM)
        IntSvc->>DB: INSERT integration_export (CRM, PENDING)
        IntSvc->>CRM: POST /api/offers (payload JSON)
        alt Succes
            CRM-->>IntSvc: 200 OK
            IntSvc->>DB: UPDATE integration_export (SUCCESS)
        else Echec
            CRM-->>IntSvc: 5xx / timeout
            IntSvc->>DB: UPDATE integration_export (FAILED, errorMessage)
            IntSvc->>Queue: RetryExportEvent (avec backoff)
        end
    and Diffusion vers centre d'appel
        Queue->>IntSvc: consume (target=CALL_CENTER)
        IntSvc->>DB: INSERT integration_export (CALL_CENTER, PENDING)
        IntSvc->>CallCenter: POST /api/offers (payload)
        CallCenter-->>IntSvc: 200 OK
        IntSvc->>DB: UPDATE integration_export (SUCCESS)
    and Diffusion vers site web
        Queue->>IntSvc: consume (target=WEBSITE)
        IntSvc->>DB: INSERT integration_export (WEBSITE, PENDING)
        IntSvc->>Website: POST /api/offers (payload)
        Website-->>IntSvc: 200 OK
        IntSvc->>DB: UPDATE integration_export (SUCCESS)
    end

    Queue->>NotifSvc: consume OfferPublishedEvent
    NotifSvc->>DB: INSERT notification (CM, CAMPAIGN_READY)
    NotifSvc-->>CM: Notification : offre publiee, campagne possible
```

---

## 7. Publication planifiée et expiration automatique

Deux transitions automatiques gérées par le même scheduler : publication différée (PLANNED -> PUBLISHED quand `publishDate` est atteint) et expiration (PUBLISHED -> OBSOLETE quand `validUntil` est atteint). Notification anticipée d'expiration au CdP et CdD.

```mermaid
sequenceDiagram
    actor CdD as Chef de departement
    participant API as API REST
    participant OfferSvc as OfferService
    participant DB as PostgreSQL
    participant Scheduler as Scheduler (Spring)
    participant Queue as RabbitMQ
    participant NotifSvc as NotificationService
    actor CdP as Chef de produit

    Note over CdD,CdP: Partie A : Publication planifiee

    CdD->>API: POST /api/v1/offers/{id}/schedule (publishDate)
    API->>OfferSvc: scheduleOffer(id, publishDate, userId)
    OfferSvc->>DB: UPDATE offer (status=PLANNED, publishDate)
    OfferSvc->>DB: INSERT offer_status_history (VALIDATED -> PLANNED)
    OfferSvc->>DB: INSERT audit_log (PUBLISH scheduled)
    API-->>CdD: Offre planifiee pour {publishDate}

    Scheduler->>DB: SELECT FROM offers WHERE status=PLANNED AND publishDate <= now()
    DB-->>Scheduler: offre(s) a publier
    Scheduler->>OfferSvc: publishOffer(id, systemUser)
    OfferSvc->>DB: UPDATE offer (status=PUBLISHED)
    OfferSvc->>DB: INSERT offer_status_history (PLANNED -> PUBLISHED)
    OfferSvc->>Queue: OfferPublishedEvent
    Note over Queue: Diffusion automatique (voir diagramme 6)

    Note over CdD,CdP: Partie B : Alerte d expiration

    Scheduler->>DB: SELECT FROM offers WHERE status=PUBLISHED AND validUntil <= now() + delai_alerte
    DB-->>Scheduler: offre(s) bientot expirees
    Scheduler->>Queue: OfferExpiringEvent
    Queue->>NotifSvc: consume
    NotifSvc-->>CdP: Notification : offre expire bientot
    NotifSvc-->>CdD: Notification : offre expire bientot

    Note over CdD,CdP: Partie C : Expiration automatique

    Scheduler->>DB: SELECT FROM offers WHERE status IN (PUBLISHED,SUSPENDED) AND validUntil <= now()
    DB-->>Scheduler: offre(s) expirees
    Scheduler->>OfferSvc: expireOffer(id, systemUser)
    OfferSvc->>DB: UPDATE offer (status=OBSOLETE)
    OfferSvc->>DB: INSERT offer_status_history (PUBLISHED -> OBSOLETE, auto)
    OfferSvc->>DB: INSERT audit_log (PUBLISH expired)
```

---

## 8. Rollback d'une offre par l'administrateur

L'administrateur système consulte l'historique des versions et restaure une version antérieure.

```mermaid
sequenceDiagram
    actor Admin as Administrateur
    participant API as API REST
    participant OfferSvc as OfferService
    participant DB as PostgreSQL

    Admin->>API: GET /api/v1/offers/{id}/versions
    API->>DB: SELECT * FROM offer_versions WHERE offerId={id} ORDER BY versionNumber
    DB-->>API: liste des versions (v1, v2, v3...)
    API-->>Admin: Historique des versions

    Admin->>API: GET /api/v1/offers/{id}/versions/{versionNumber}
    API->>DB: SELECT snapshot FROM offer_versions WHERE ...
    DB-->>API: snapshot JSON complet
    API-->>Admin: Detail de la version (diff avant/apres)

    Admin->>API: POST /api/v1/offers/{id}/rollback (targetVersion)
    API->>OfferSvc: rollbackOffer(id, targetVersion, userId)
    OfferSvc->>DB: SELECT snapshot FROM offer_versions WHERE versionNumber=targetVersion
    DB-->>OfferSvc: snapshot JSON
    OfferSvc->>DB: UPDATE offer SET (champs du snapshot)
    OfferSvc->>DB: INSERT offer_version (nouveau snapshot = copie de la version cible)
    OfferSvc->>DB: INSERT audit_log (UPDATE, rollback from vX to vY)
    DB-->>OfferSvc: OK
    OfferSvc-->>API: 200 OK (offre restauree)
    API-->>Admin: Offre restauree a la version {targetVersion}
```

---

## 9. Authentification (login avec MFA et fingerprint)

Connexion sécurisée avec JWT (access + refresh token), fingerprint binding, token versioning, et MFA TOTP. Verrouillage du compte après 5 échecs. Rotation du refresh token à chaque usage.

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant WAF as WAF ModSecurity
    participant API as API REST
    participant RateLimit as RateLimitFilter
    participant AuthSvc as AuthService
    participant DB as PostgreSQL
    participant Metrics as SecurityMetrics

    User->>WAF: POST /auth/login (email, password, totpCode?)
    WAF->>API: Requete filtree (OWASP CRS)
    API->>RateLimit: Verification rate limit
    RateLimit-->>API: OK (sous le seuil)
    API->>AuthSvc: authenticate(email, password)
    AuthSvc->>DB: SELECT * FROM users WHERE email=?
    DB-->>AuthSvc: user (ou null)

    alt Utilisateur inexistant
        AuthSvc->>Metrics: recordLoginFailed()
        AuthSvc-->>API: 401 Unauthorized
        API-->>User: Email ou mot de passe incorrect
    else Compte verrouille (status=LOCKED)
        AuthSvc->>Metrics: recordLoginFailed() + recordAccountLockout()
        AuthSvc-->>API: 423 Locked
        API-->>User: Compte verrouille, contactez l administrateur
    else Mot de passe incorrect
        AuthSvc->>DB: UPDATE user SET failedLoginAttempts += 1
        opt failedLoginAttempts >= 5
            AuthSvc->>DB: UPDATE user SET status=LOCKED
            AuthSvc->>Metrics: recordAccountLockout()
        end
        AuthSvc->>Metrics: recordLoginFailed()
        AuthSvc-->>API: 401 Unauthorized
        API-->>User: Email ou mot de passe incorrect
    else Mot de passe correct
        AuthSvc->>DB: UPDATE user SET failedLoginAttempts=0, lastLoginAt=now()

        alt MFA TOTP active (totpEnabled=true)
            AuthSvc->>Metrics: recordMfaChallenge()
            alt Code TOTP absent
                AuthSvc-->>API: MFA_REQUIRED
                API-->>User: 200 (mfaRequired=true)
            else Code TOTP invalide
                AuthSvc->>Metrics: recordMfaFailure()
                AuthSvc-->>API: 401 Code MFA invalide
                API-->>User: Code MFA invalide
            else Code TOTP valide
                Note over AuthSvc: MFA verifie, continuer
            end
        end

        AuthSvc-->>AuthSvc: generateFingerprint()
        AuthSvc-->>AuthSvc: generateAccessToken(userId, role, tokenVersion, fingerprintHash)
        AuthSvc-->>AuthSvc: generateRefreshToken(userId, role, tokenVersion, fingerprintHash)
        AuthSvc->>DB: INSERT refresh_token (tokenHash SHA-256, expiresAt)
        AuthSvc->>Metrics: recordLoginSuccess()
        AuthSvc-->>API: accessToken + refreshToken + fingerprint
        API-->>User: 200 OK (tokens + fingerprint + user info)
    end
```

**Points de sécurité :**
- **WAF** : ModSecurity avec OWASP Core Rule Set v4 filtre les requêtes en amont (injection SQL, XSS, etc.)
- **Rate limiting** : 5 tentatives par minute sur `/auth/login`
- **Fingerprint binding** : un fingerprint aléatoire est généré côté serveur, hashé et inclus dans le JWT. Le client doit le renvoyer dans le header `X-Fingerprint` pour chaque requête authentifiée.
- **Token versioning** : le tokenVersion de l'utilisateur est inclus dans le JWT. Si l'utilisateur change son mot de passe, le tokenVersion est incrémenté et tous les anciens tokens sont invalidés.
- **Refresh token rotation** : à chaque usage du refresh token, l'ancien est révoqué et un nouveau est émis.
- **MFA obligatoire** : pour les utilisateurs avec le rôle `ADMIN_SYSTEME`, le MfaPolicyFilter bloque l'accès aux ressources si le MFA n'est pas activé.

---

## 10. Création d'un produit avec détection de doublons

Le chef de produit crée un produit. Le système vérifie automatiquement s'il existe un doublon potentiel et le signale.

```mermaid
sequenceDiagram
    actor CdP as Chef de produit
    participant API as API REST
    participant CatSvc as CatalogService
    participant DupSvc as DuplicateDetectionService
    participant DB as PostgreSQL

    CdP->>API: POST /api/v1/products (name, description, characteristics, categoryId)
    API->>CatSvc: createProduct(dto, userId)
    CatSvc->>DupSvc: checkDuplicates(name, characteristics)
    DupSvc->>DB: SELECT * FROM products WHERE similarity(name, ?) > seuil
    DB-->>DupSvc: produits similaires (ou vide)

    alt Doublons detectes
        DupSvc-->>CatSvc: duplicates[] avec scores
        CatSvc->>DB: INSERT product (status=ACTIVE)
        CatSvc->>DB: INSERT duplicate_flag(s) pour chaque doublon
        CatSvc->>DB: INSERT audit_log (CREATE, product)
        CatSvc-->>API: 201 Created (product + warnings: doublons)
        API-->>CdP: Produit cree + AVERTISSEMENT doublons detectes
    else Aucun doublon
        CatSvc->>DB: INSERT product (status=ACTIVE)
        CatSvc->>DB: INSERT audit_log (CREATE, product)
        CatSvc-->>API: 201 Created (product)
        API-->>CdP: Produit cree
    end
```

---

## 11. Campagne de diffusion réseaux sociaux (Community Manager)

Le Community Manager prépare et lance une campagne de diffusion vers les réseaux sociaux et sites partenaires, avec suivi des statistiques.

```mermaid
sequenceDiagram
    actor CM as Community Manager
    participant API as API REST
    participant CampSvc as CampaignService
    participant DB as PostgreSQL
    participant Queue as RabbitMQ
    participant SocialSvc as SocialMediaService

    CM->>API: POST /api/v1/campaigns (offerId, name, channels[])
    API->>CampSvc: createCampaign(dto, userId)
    CampSvc->>DB: INSERT campaign (status=DRAFT)
    CampSvc->>DB: INSERT campaign_channel pour chaque canal
    CampSvc-->>API: 201 Created (campaign)
    API-->>CM: Campagne creee (DRAFT)

    CM->>API: PUT /api/v1/campaigns/{id}/channels/{channelId} (message adapte)
    API->>DB: UPDATE campaign_channel SET message=?
    API-->>CM: Message adapte pour {canal}

    CM->>API: POST /api/v1/campaigns/{id}/publish
    API->>CampSvc: publishCampaign(id, userId)
    CampSvc->>DB: UPDATE campaign (status=PUBLISHED)

    par Envoi Facebook
        CampSvc->>Queue: PublishToChannelEvent (FACEBOOK)
        Queue->>SocialSvc: consume
        SocialSvc->>DB: UPDATE campaign_channel (status=SENT, sentAt)
        SocialSvc->>DB: INSERT campaign_stats (views=0, clicks=0)
    and Envoi Instagram
        CampSvc->>Queue: PublishToChannelEvent (INSTAGRAM)
        Queue->>SocialSvc: consume
        SocialSvc->>DB: UPDATE campaign_channel (status=SENT, sentAt)
        SocialSvc->>DB: INSERT campaign_stats
    and Envoi LinkedIn
        CampSvc->>Queue: PublishToChannelEvent (LINKEDIN)
        Queue->>SocialSvc: consume
        SocialSvc->>DB: UPDATE campaign_channel (status=SENT, sentAt)
        SocialSvc->>DB: INSERT campaign_stats
    end

    CampSvc-->>API: 200 OK
    API-->>CM: Campagne diffusee

    Note over CM,SocialSvc: Plus tard : consultation des stats
    CM->>API: GET /api/v1/campaigns/{id}/stats
    API->>DB: SELECT cs.* FROM campaign_stats cs JOIN campaign_channels ...
    DB-->>API: stats par canal
    API-->>CM: Vues, clics, engagement par canal
```

---

## 12. Configuration MFA TOTP

L'utilisateur configure l'authentification multi-facteur TOTP (RFC 6238). Le secret est chiffré en AES-256-GCM avant stockage. L'activation nécessite la vérification d'un code valide.

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant API as API REST
    participant AuthSvc as AuthService
    participant TotpSvc as TotpService
    participant EncSvc as EncryptionService
    participant DB as PostgreSQL

    Note over User,DB: Phase 1 : Generation du secret TOTP

    User->>API: POST /api/v1/auth/totp/setup
    API->>AuthSvc: setupTotp(userId)
    AuthSvc->>DB: SELECT * FROM users WHERE id=userId
    DB-->>AuthSvc: user

    alt MFA deja active
        AuthSvc-->>API: 409 Conflict (MFA deja active)
        API-->>User: MFA deja active
    else MFA non active
        AuthSvc->>TotpSvc: generateSecret()
        TotpSvc-->>AuthSvc: secret (base32, 20 octets)
        AuthSvc->>EncSvc: encrypt(secret)
        EncSvc-->>AuthSvc: secretChiffre (AES-256-GCM)
        AuthSvc->>DB: UPDATE user SET totpSecret=secretChiffre
        AuthSvc->>TotpSvc: buildOtpAuthUri(secret, email)
        TotpSvc-->>AuthSvc: otpauth://totp/MoovPIM:email?secret=...
        AuthSvc-->>API: secret + otpauthUri
        API-->>User: QR code + secret (a scanner dans l app TOTP)
    end

    Note over User,DB: Phase 2 : Verification et activation

    User->>API: POST /api/v1/auth/totp/enable (code a 6 chiffres)
    API->>AuthSvc: enableTotp(userId, code)
    AuthSvc->>DB: SELECT totpSecret FROM users WHERE id=userId
    DB-->>AuthSvc: secretChiffre
    AuthSvc->>EncSvc: decrypt(secretChiffre)
    EncSvc-->>AuthSvc: secret
    AuthSvc->>TotpSvc: verifyCode(secret, code)

    alt Code invalide
        TotpSvc-->>AuthSvc: false
        AuthSvc-->>API: 401 Code MFA invalide
        API-->>User: Code invalide, reessayez
    else Code valide
        TotpSvc-->>AuthSvc: true
        AuthSvc->>DB: UPDATE user SET totpEnabled=true
        AuthSvc->>DB: INSERT audit_log (MFA_SETUP, user)
        AuthSvc-->>API: 200 OK
        API-->>User: MFA active avec succes
    end
```

---

## 13. Enregistrement d'une Passkey WebAuthn

L'utilisateur enregistre une clé de sécurité FIDO2/WebAuthn (Passkey) comme second facteur d'authentification. Le protocole WebAuthn suit le flux challenge-response du standard W3C.

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant Browser as Navigateur
    participant API as API REST
    participant WebAuthnSvc as WebAuthnService
    participant DB as PostgreSQL

    Note over User,DB: Phase 1 : Demande des options d enregistrement

    User->>Browser: Clic "Ajouter une Passkey"
    Browser->>API: POST /api/v1/auth/webauthn/register/options
    API->>WebAuthnSvc: startRegistration(userId)
    WebAuthnSvc->>DB: SELECT credentialId FROM webauthn_credentials WHERE userId=?
    DB-->>WebAuthnSvc: credentials existants (pour exclusion)
    WebAuthnSvc-->>API: PublicKeyCredentialCreationOptions (challenge, rpId, userId, excludeCredentials)
    API-->>Browser: options JSON

    Note over User,DB: Phase 2 : Creation de la credential par l authenticator

    Browser->>Browser: navigator.credentials.create(options)
    Browser->>User: Verification biometrique / PIN
    User-->>Browser: Validation
    Browser-->>Browser: Keypair generee, attestation signee

    Note over User,DB: Phase 3 : Verification et stockage

    Browser->>API: POST /api/v1/auth/webauthn/register/verify (attestationResponse)
    API->>WebAuthnSvc: finishRegistration(userId, attestation)
    WebAuthnSvc-->>WebAuthnSvc: Verification attestation (rpId, challenge, origin)
    WebAuthnSvc->>DB: INSERT webauthn_credential (credentialId, publicKeyCose, signatureCount, userHandle)
    WebAuthnSvc->>DB: INSERT audit_log (MFA_SETUP, webauthn)
    WebAuthnSvc-->>API: 201 Created
    API-->>Browser: Passkey enregistree
    Browser-->>User: Confirmation
```

---

## 14. Changement de mot de passe (avec politique de sécurité)

Le changement de mot de passe applique une politique stricte : longueur minimale, complexité, et vérification HIBP (Have I Been Pwned) via k-anonymity. Tous les tokens existants sont invalidés.

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant API as API REST
    participant AuthSvc as AuthService
    participant PwdPolicy as PasswordPolicyService
    participant HIBP as API HIBP (k-anonymity)
    participant DB as PostgreSQL

    User->>API: POST /api/v1/auth/change-password (currentPassword, newPassword)
    API->>AuthSvc: changePassword(userId, request)
    AuthSvc->>DB: SELECT * FROM users WHERE id=userId
    DB-->>AuthSvc: user

    AuthSvc->>AuthSvc: passwordEncoder.matches(currentPassword, user.passwordHash)

    alt Mot de passe actuel incorrect
        AuthSvc-->>API: 401 Mot de passe actuel incorrect
        API-->>User: Mot de passe actuel incorrect
    else Nouveau = ancien
        AuthSvc-->>API: 400 Le nouveau mot de passe doit etre different
        API-->>User: Mot de passe identique a l ancien
    else Mot de passe actuel correct
        AuthSvc->>PwdPolicy: validate(newPassword)

        PwdPolicy->>PwdPolicy: Verification longueur >= 12
        PwdPolicy->>PwdPolicy: Verification majuscule, minuscule, chiffre, special
        PwdPolicy->>PwdPolicy: SHA-1(newPassword) -> prefix (5 chars) + suffix

        PwdPolicy->>HIBP: GET /range/{prefix}
        HIBP-->>PwdPolicy: liste de suffixes compromis

        alt Politique non respectee
            PwdPolicy-->>AuthSvc: PasswordPolicyViolationException (details)
            AuthSvc-->>API: 400 Politique de mot de passe non respectee
            API-->>User: Details des violations
        else Mot de passe compromis (HIBP)
            PwdPolicy-->>AuthSvc: PasswordPolicyViolationException (compromis)
            AuthSvc-->>API: 400 Mot de passe compromis
            API-->>User: Ce mot de passe a ete compromis
        else Politique respectee
            PwdPolicy-->>AuthSvc: OK

            AuthSvc->>DB: UPDATE user SET passwordHash=bcrypt(new), tokenVersion++
            AuthSvc->>DB: UPDATE refresh_tokens SET revoked=true WHERE userId=? AND revoked=false
            AuthSvc->>DB: INSERT audit_log (CHANGE_PASSWORD, user)

            AuthSvc-->>AuthSvc: generateFingerprint() + generateTokens(new tokenVersion)
            AuthSvc->>DB: INSERT refresh_token (new tokenHash)
            AuthSvc-->>API: 200 OK (newAccessToken + newRefreshToken + fingerprint)
            API-->>User: Mot de passe change, nouveaux tokens emis
        end
    end
```

---

## 15. Rotation des clés et révocation d'urgence

L'administrateur système gère la rotation des clés cryptographiques et peut déclencher une révocation d'urgence de toutes les sessions en cas de compromission.

```mermaid
sequenceDiagram
    actor Admin as Administrateur
    participant API as API REST
    participant KeyMgmt as KeyManagementService
    participant DB as PostgreSQL
    participant Metrics as SecurityMetrics

    Note over Admin,Metrics: Scenario A : Rotation planifiee des cles de session

    Admin->>API: POST /api/v1/admin/keys/rotate-session
    API->>KeyMgmt: rotateSessionKeys()
    KeyMgmt->>DB: UPDATE refresh_tokens SET revoked=true WHERE revoked=false
    KeyMgmt->>DB: INSERT audit_log (KEY_ROTATE, session-keys)
    KeyMgmt->>Metrics: recordKeyRotation("session")
    KeyMgmt-->>API: 200 OK (tokensRevoked: N)
    API-->>Admin: Cles de session rotees, N tokens revoques

    Note over Admin,Metrics: Scenario B : Revocation d urgence

    Admin->>API: POST /api/v1/admin/keys/emergency-revoke
    API->>KeyMgmt: emergencyRevokeAllSessions()
    KeyMgmt->>DB: UPDATE refresh_tokens SET revoked=true WHERE revoked=false
    DB-->>KeyMgmt: tokensRevoked = N
    KeyMgmt->>DB: UPDATE users SET token_version = token_version + 1
    DB-->>KeyMgmt: usersAffected = M
    KeyMgmt->>DB: INSERT audit_log (EMERGENCY_REVOKE)
    KeyMgmt->>Metrics: recordEmergencyRevocation()
    KeyMgmt-->>API: 200 OK (tokensRevoked: N, usersAffected: M)
    API-->>Admin: Revocation d urgence : N tokens revoques, M utilisateurs

    Note over Admin,Metrics: Scenario C : Verification automatique (scheduler)

    Note right of KeyMgmt: @Scheduled(cron = lundi 2h00)
    KeyMgmt->>KeyMgmt: checkKeyRotationCompliance()
    KeyMgmt->>KeyMgmt: Verifier age des cles (session 90j, master 365j)
    alt Rotation en retard
        KeyMgmt->>Metrics: Alerte : rotation en retard
    else Conforme
        KeyMgmt->>Metrics: Statut OK
    end
```

---

## 16. Upload de fichier avec scan antivirus ClamAV

Chaque fichier uploadé est scanné par ClamAV avant d'être stocké dans MinIO. Les fichiers infectés sont rejetés avec un log d'audit.

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant API as API REST
    participant DLP as DlpFilter
    participant MediaSvc as MediaService
    participant ClamAV as ClamAV (clamd)
    participant DAM as MinIO (S3)
    participant DB as PostgreSQL
    participant Metrics as SecurityMetrics

    User->>API: POST /api/v1/offers/{id}/media (multipart/form-data)
    API->>DLP: Verification DLP (taille, type MIME)

    alt Fichier trop volumineux ou type interdit
        DLP-->>API: 413 / 415
        API-->>User: Fichier rejete (taille ou type)
    else DLP OK
        DLP-->>API: OK
        API->>MediaSvc: uploadMedia(offerId, file, userId)
        MediaSvc->>ClamAV: INSTREAM (flux binaire via socket TCP :3310)
        ClamAV-->>MediaSvc: scan result

        alt Virus detecte
            MediaSvc->>DB: INSERT audit_log (DELETE, malware detected, filename)
            MediaSvc->>Metrics: recordMalwareDetected()
            MediaSvc-->>API: 422 Fichier infecte
            API-->>User: Fichier rejete : virus detecte
        else Fichier sain
            MediaSvc->>DAM: putObject(bucket, storageKey, file)
            DAM-->>MediaSvc: OK
            MediaSvc->>DB: INSERT media_asset (conformityStatus=PENDING)
            MediaSvc->>DB: INSERT offer_media (offerId, mediaAssetId)
            MediaSvc->>DB: INSERT audit_log (CREATE, media_asset)
            MediaSvc-->>API: 201 Created (mediaAssetDto)
            API-->>User: Media uploade avec succes
        end
    end
```
