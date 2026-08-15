# Contexte projet + règles de travail — Claude Code

## Projet
PIM — Plateforme de gestion de l'information produits et offres (Moov Burkina). Plateforme web et mobile de gestion des offres convergentes et du catalogue d'offres : centraliser, harmoniser et enrichir le catalogue de produits et de services de Moov Burkina, et diffuser cette information en temps réel vers les canaux (API/export pour CRM, centre d'appel).

Repos : **Décidé** — dépôt personnel sur **GitHub** (pas GitLab.com : demande une vérification par carte bancaire à la création de compte, non disponible pour l'instant ; GitHub n'exige rien de tout ça pour un compte gratuit). Peu probable qu'un travail de soutenance de licence soit hébergé sur l'instance interne Moov (`gitlab.avepay.net`) de toute façon, contrairement à DMP qui est un vrai livrable d'entreprise. À reconfirmer avec le **maître de stage (M. Keita Boubacar)** si le PIM devait un jour devenir un vrai livrable Moov nécessitant l'instance interne.
Identité git locale — **confirmée** : `Drissa KOUSSOUBE <drissakoussoube54@gmail.com>` (`git config --global user.name/user.email`). Note : sur DMP, les branches utilisaient un préfixe personnel (`elvithon`) car plusieurs développeurs partagent le même dépôt — ce n'était pas votre pseudo, mais celui de la personne qui vous a fourni le fichier modèle. Sur ce dépôt personnel solo, ce préfixe n'a plus lieu d'être : voir la convention de branches simplifiée dans la section Git plus bas.
Branche de référence : develop *(proposition — reprend la convention DMP, à valider)*, JAMAIS main.
Je suis Koussoube Drissa, stagiaire chez Moov Africa Burkina Faso, sur le projet PIM — qui est aussi mon **sujet de soutenance de Licence 3**. Deux encadrants : **professeur de suivi, M. Tindano Olivier** (école, partie académique/UML/mémoire) et **maître de stage, M. Keita Boubacar** (Moov, partie technique/produit réelle).

> ⚠️ Ce document mélange deux types d'éléments :
> - Des **propositions techniques** (marquées *proposition à valider*), que je peux faire parce que ce sont des choix d'ingénierie raisonnables — à valider avec le **maître de stage (M. Keita Boubacar)** avant de les considérer comme acquis.
> - Des **faits réels** que je ne peux pas inventer (noms de personnes, URL de repo, décisions déjà prises en interne) — marqués **[À CONFIRMER]**, à compléter par vous.

---

## Stack technique

### Backend
- Java **21 LTS** — **confirmé** : `java -version` en local donne `openjdk 21.0.11 (Temurin)`.
- Build tool : **Maven 3.9.16** — **confirmé** installé en local (`mvn -version`), cohérent avec la commande `mvn compile` utilisée sur DMP.
- Spring Boot **4.1.x** (dernière stable, juin 2026) *(proposition — DMP est en Spring Boot 3.4.1 ; passer sur la ligne 4.x pour un projet qui démarre maintenant a du sens et reste compatible avec Java 21 (minimum requis : Java 17), mais c'est un saut de version majeure — Spring Framework 7 — à valider avec l'équipe, notamment si des composants doivent rester alignés avec DMP)*
- Base de données : **PostgreSQL 18.4** — **confirmé** installé en local (`psql --version`), aligné avec la proposition initiale (dernière stable). DMP est en PostgreSQL 16 ; à harmoniser selon la politique infra de Moov si besoin.
- Stratégie tenant : **mono-tenant** *(proposition — le PIM semble interne à Moov Burkina, contrairement à DMP qui est un SaaS multi-organisations)*. **[À CONFIRMER]** : le PIM doit-il à terme couvrir d'autres filiales Moov Africa ? Si oui, revoir pour un modèle multi-tenant avec RLS comme sur DMP — c'est une décision produit à remonter à [encadrant].
- Gestion du schéma : **Flyway** (ddl-auto=none) *(proposition — reprend le pattern DMP, l'équipe le connaît déjà)*
- Stockage des médias (module DAM) : **MinIO en local / S3-compatible en prod** *(proposition standard pour ce type de besoin)*
- Authentification / habilitations : **JWT stateless (access + refresh)** + modèle de rôles fins pour le module "droits et habilitations" *(proposition, reprend le pattern DMP)*. **[À CONFIRMER]** : Moov Burkina a-t-il déjà un SSO/annuaire interne (LDAP/AD, Keycloak...) à réutiliser plutôt que de construire une auth dédiée ? Point à vérifier avant de trancher.
- Message broker / async : **RabbitMQ** *(proposition — utile pour notifications, workflow de validation, jobs IA de génération de contenu ; reprend l'expérience DMP)*
- Package racine : **com.moov.pim** *(proposition à valider — dépend du nom de domaine/convention réel de Moov)*
- Port backend : **8092** *(proposition — évite le conflit avec le 8090 de DMP si les deux tournent en local)*, base path API : **/api/v1**

### Frontend web — React
- **Confirmé** : Node.js **v24.16.0** et npm **11.13.0** installés en local. pnpm n'est pas encore installé (`pnpm -v` échoue) — à installer avec `npm install -g pnpm` le moment venu.
- Framework meta : **Next.js 14/15** *(proposition — reprend le pattern DMP portal, accélère l'onboarding de l'équipe qui le connaît déjà)*
- Gestion d'état / data fetching : **TanStack Query v5** *(proposition, reprend DMP)*
- UI kit / design system : **Radix UI + Tailwind** *(proposition, reprend DMP — à voir si un design system Moov existant doit être réutilisé à la place)*
- Port de dev : **3002** *(proposition — évite le conflit avec le 3001 de DMP)*

### Mobile — Flutter
- **Confirmé** : Flutter n'est pas encore installé sur le poste (`flutter --version` ne répond pas).
- Version SDK : **Flutter 3.44 / Dart 3.12** (dernière stable, mai 2026) *(proposition — à réévaluer à la date réelle de démarrage du dev mobile, car Flutter sort une nouvelle stable environ tous les 3 mois)*
- Gestion d'état : **Riverpod** *(proposition — pattern moderne recommandé par l'écosystème Flutter actuel ; Bloc est une alternative valable si c'est un standard déjà en place chez Moov)*
- Cibles : **[À CONFIRMER]** — Android et iOS tous les deux, ou une priorité entre les deux ? C'est une décision produit (coûts de dev/tests doublés) à remonter à [encadrant].

### Infra locale
**Confirmé** : rien n'est encore configuré (Docker inclus). docker-compose avec PostgreSQL, RabbitMQ, MinIO *(proposition, à ajuster selon les choix ci-dessus une fois validés)*.

---

## Architecture backend
**Proposition** : monolithe modulaire avec Spring Modulith, comme sur DMP — cohérent avec l'expérience de l'équipe et adapté à la taille du projet à ce stade. Découpage envisagé, à affiner lors de la modélisation UML :
`catalog`, `rules` (règles et dépendances), `lifecycle` (cycle de vie des offres), `dam` (actifs numériques), `workflow` (validation graphique), `permissions` (droits/habilitations), `notification`, `analytics`, `ai-content` (génération), `ai-tagging` (classification), `integration` (export CRM/centre d'appel).

Même structure de dossiers que DMP par module : `internal/{domain, dto, repository, service, web}` + `spi/`, `event/` optionnels. Règle identique : jamais d'accès direct aux classes `internal` d'un autre module, uniquement via API publique (`*Api`) ou événements Spring.

**[À CONFIRMER]** : ce découpage doit être validé lors de la modélisation UML — c'est une proposition de départ, pas une décision arrêtée.

---

## Périmètre fonctionnel — modules (d'après le cahier des charges)

Le détail technique (entités, services, endpoints) de chaque module reste à définir lors de la modélisation UML. Voici le périmètre fonctionnel connu à ce stade :

### 1. Catalogue
Modélisation et gestion des produits physiques, des services d'offre et des packs.

### 2. Règles et dépendances
Gestion des règles métier et des dépendances entre produits/offres (compatibilités, exclusions, prérequis).

### 3. Cycle de vie des offres
Suivi des offres à travers leurs différents états (création → validation → publication → retrait, etc. — étapes exactes à définir).

### 4. Actifs numériques — DAM intégré
Stockage et association des fichiers médias (images, vidéos, notices PDF) aux fiches produits. Vérification de conformité des médias (résolution, format, droits d'auteur).

### 5. Workflow de validation graphique
Circuit de validation des contenus/visuels avant publication.

### 6. Droits et habilitations
Gestion fine des rôles, historique complet des modifications, avec possibilité de rollback.

### 7. Notifications
**[À détailler]** — canaux, déclencheurs, destinataires.

### 8. Analytics et KPIs
Suivi du Time To Market (temps de la création d'un produit à sa mise en ligne). Suivi de la productivité des équipes par étape du workflow.

### 9. IA — génération automatique de contenu
Génération de descriptions marketing (courtes et longues) optimisées SEO à partir de caractéristiques techniques.

### 10. IA — classification intelligente (auto-tagging)
Extraction automatique de données depuis des fiches techniques.

### 11. Diffusion temps réel
Exposition de l'information produit en temps réel via API ou export, pour consommation par le CRM et le centre d'appel.

---

## Architecture frontend
**Proposition** (à documenter précisément une fois posée) :
- Web : structure inspirée du portal DMP — route groups Next.js, appels API via un client typé dédié (`@moov-pim/api-client` ou équivalent), hooks TanStack Query dans `src/hooks/`, composants UI mutualisés.
- Mobile : architecture Flutter en couches (présentation / domaine / données), état géré par Riverpod, structure d'écrans à définir lors du découpage UML des parcours.

---

## Modélisation / migrations
Flyway *(proposition, reprend DMP)*. Diagrammes UML de référence à lier ici une fois produits.

## Tests
**Proposition** : JUnit 5 + Mockito + Testcontainers (PostgreSQL) côté backend ; Jest + React Testing Library côté web ; `flutter_test` + `integration_test` côté mobile. À ajuster selon les standards Moov s'ils existent déjà.

---

## Règles absolues
1. NE JAMAIS INVENTER de code, noms de fichiers, fonctions ou comportements. Si pas sûr → vérifier dans le code AVANT. Pas de supposition. Cette règle s'applique aussi à l'architecture tant qu'elle n'est pas validée : les propositions ci-dessus restent des propositions, pas des faits acquis.
2. MODE LECTURE SEULE PAR DÉFAUT pour toute investigation : "Mode lecture seule strict, RAPPORT UNIQUEMENT, aucune action". Rien n'est écrit/modifié/exécuté tant que je n'ai pas validé.
3. Avant toute modification : audit lecture seule du fichier (structure réelle, noms exacts des champs, imports existants, patterns en place).
4. Me MONTRER le diff (git diff) + résultat de compilation/lint (backend, web, mobile) AVANT de committer. S'arrêter là et attendre ma validation.
5. NE TOUCHER À AUCUN fichier hors scope.
6. Suivre les patterns DÉJÀ présents dans le code une fois établis, ne pas inventer une autre façon de faire.
7. Respecter les frontières entre modules/composants dès qu'elles seront définies par la modélisation.
8. Je suis stagiaire/junior : je ne décide pas de l'architecture ni des choix produit seul. Décisions académiques → **professeur de suivi (M. Tindano Olivier)**. Décisions techniques/produit chez Moov → **maître de stage (M. Keita Boubacar)**.

## Git
*(Adapté : dépôt personnel, développeur unique — retiré : MR/PR, cible develop obligatoire, règle "pas de self-merge", qui supposent une équipe. Gardé : toute la discipline de validation avec moi, qui reste identique.)*
- **Confirmé** : Git 2.55.0 installé, identité locale `Drissa KOUSSOUBE <drissakoussoube54@gmail.com>`.
- Commits conventionnels EN FRANÇAIS : type(scope): description.
- Branches par grande phase/lot : `feat/uml-modelisation`, `feat/backend-catalogue`, `feat/mobile-flutter`, etc. Une fois une phase validée, merge direct dans `main`.
- Toujours partir de `main` à jour (git checkout main && git pull) avant de créer une branche.
- NE PAS push sans mon accord explicite.
- Avant un commit : vérifier la branche (git rev-parse --abbrev-ref HEAD) et que seuls les fichiers voulus sont modifiés (git status --short).
- Actions destructives (DROP, reset --hard, push --force / --force-with-lease, branch -D) : seulement après ma validation explicite, avec explication du risque.

## Méthode
- Phase 1 : analyse et modélisation UML avant tout code — cas d'usage, diagrammes de classes/séquence, validés par le **professeur de suivi (M. Tindano Olivier)**.
- Étapes courtes, palier de validation à chaque étape.
- Tester en réel avant de considérer une tâche finie, sur les trois fronts (backend, web, mobile) quand c'est pertinent.
- Distinguer bug avéré (vérifié dans le code) vs "à confirmer" (décision produit → **maître de stage (M. Keita Boubacar)**, décision méthodologique → **professeur de suivi (M. Tindano Olivier)**).
- Si réserve/doute : lever par une vérification AVANT de continuer.
- Je colle les retours de commandes, tu analyses — tu ne supposes pas le résultat.

## Communication
Direct, factuel, honnête. Si une approche a un défaut, me le dire clairement. Analyse de risque avant d'agir.
