# LISTE COMPLÈTE DES FONCTIONNALITÉS — PLATEFORME MOOV BURKINA

> Ce document recense, module par module, l'ensemble des fonctionnalités déjà validées au fil de nos échanges (Chapitre I, Chapitre II, CDCF v1.0, diagrammes de cas d'utilisation). La dernière section propose des innovations complémentaires que je juge pertinentes mais qui **n'ont pas encore été validées avec vous** — à examiner et à accepter ou écarter avant de les intégrer au mémoire ou au développement.

---

## 1. Comptes, authentification et habilitations

- Connexion / déconnexion sécurisées
- Verrouillage du compte après plusieurs échecs de connexion
- Gestion du profil et du mot de passe par chaque utilisateur
- 6 rôles fixes et prédéfinis, sans permission modulable au cas par cas : Administrateur système, Chef de produit, Chef de service, Chef de département marketing et produits, Analyste marketing, Community Manager
- Gestion des comptes utilisateurs par l'administrateur (création, désactivation, changement de rôle)
- Historique complet des modifications consultable par l'administrateur (vue globale, avec rollback)
- Historique des modifications consultable par chaque acteur sur ses propres fiches uniquement (lecture seule, sans rollback)
- Audit des connexions et des actions sensibles
- Configuration des canaux de notification par l'administrateur

## 2. Catalogue — produits, services, packs

- Création, modification, consultation, classement (catégories) et archivage des produits physiques
- Création, modification, consultation, classement et archivage des services d'offre
- Création de packs par assemblage de produits et/ou services
- Association de produits/services à un pack
- Détection de doublons à la création d'un produit
- Score de qualité de fiche avant soumission
- Recherche sémantique dans le catalogue

## 3. Règles et dépendances

- Définition et modification de règles métier (compatibilité, incompatibilité, composition obligatoire, vente uniquement en pack)
- Vérification automatique des règles au moment où le chef de produit assemble une offre, avec blocage ou avertissement avant soumission
- Vérification de la cohérence globale des règles par l'administrateur
- Consultation des règles appliquées à une offre donnée

## 4. Cycle de vie des offres et workflow de validation

- Création d'une offre par le chef de produit à partir de produits/packs existants
- Cycle de vie à 10 statuts : Brouillon → En enrichissement → En validation → Validée → Planifiée → Publiée → Suspendue → Obsolète → Retirée → Archivée
- Enrichissement de la même fiche par l'analyste marketing (description, visuels, SEO), sans duplication ni silo
- Validation ou rejet avec commentaire par le chef de service (niveau opérationnel)
- Validation finale décisionnelle/stratégique par le chef de département, avec vérification des mentions légales
- Possibilité pour le chef de département d'annuler une offre déjà validée par le chef de service, sur consigne de la direction
- Correction et resoumission par le chef de produit en cas de rejet, avec reprise du même circuit
- Publication, suspension, mise en obsolescence, retrait et archivage d'une offre
- Historique visuel des modifications (diff avant/après)

## 5. Validation graphique (circuit dédié)

- Dépôt des visuels par l'analyste marketing (image, vidéo, PDF)
- Vérification automatique de conformité (résolution, format, signalement des risques liés aux droits d'auteur)
- Annotation détaillée des médias selon leur type, par le chef de service
- Comparaison de versions des médias
- Validation ou rejet spécifique des actifs graphiques, indépendamment de la validation métier générale
- Correction et redépôt par l'analyste marketing en cas de rejet

## 6. Gestion des actifs numériques (DAM)

- Stockage et association des fichiers médias aux fiches produits/offres
- Bibliothèque de médias réutilisables
- Éléments de charte graphique du groupe Moov Africa mis à disposition (logos fond bleu / fond blanc selon le contexte)

## 7. Génération de contenu et intelligence artificielle

- Auto-tagging / extraction automatique de données depuis les fiches techniques, côté chef de produit, à la création du produit/offre
- Génération de descriptions marketing courtes et longues optimisées SEO, côté analyste marketing, à partir des caractéristiques techniques
- Test A/B sur le contenu marketing d'une offre
- Assistant conversationnel interne, accessible à tous les acteurs internes

## 8. Notifications

- Analyste marketing notifié quand une offre attend son habillage
- Chef de service notifié à la soumission d'une offre
- Chef de département notifié quand le chef de service valide
- Chef de produit notifié en cas de rejet et de publication
- Community manager notifié à la publication

## 9. Analytique et indicateurs (KPI)

- Suivi du Time To Market (temps entre la création et la mise en ligne), avec identification des goulots d'étranglement — réservé à la vue globale du chef de département
- Suivi de la productivité des équipes par étape du workflow — réservé au chef de département
- Suivi du temps de traitement individuel — visible par l'analyste marketing pour lui-même uniquement, sans vue d'équipe
- Taux de complétude du catalogue
- Rapprochement CRM (croisé ventes/offres)
- Configuration des indicateurs suivis par l'administrateur

## 10. Diffusion et intégration multicanale

- Diffusion automatique et en temps réel de la fiche complète, dès publication, vers le CRM, le centre d'appel et le site web/e-boutique
- Préparation de campagnes de diffusion par le community manager (choix des réseaux ciblés, message adapté par canal)
- Programmation de la diffusion à une date/heure future
- Diffusion vers les réseaux sociaux (Facebook, Instagram, LinkedIn) et vers les sites partenaires
- Suivi des statistiques de diffusion par canal (vues, clics, engagement)
- Export du catalogue par l'administrateur, action autonome sans lien avec le CRM
- Resynchronisation en cas d'échec de diffusion

## 11. Mobile

- Accès aux mêmes fonctionnalités que le web, par acteur, sans différenciation fonctionnelle
- Interface adaptée au format mobile (Flutter), consommant la même API que le web

---

## PROPOSITIONS D'INNOVATIONS COMPLÉMENTAIRES (non encore validées)

Ces pistes ne font pas partie du périmètre déjà validé avec vous. Je les propose parce qu'elles complètent naturellement la logique déjà construite et qu'elles sont réalistes dans un projet de ce type — mais rien n'est décidé ; à vous de les retenir, les adapter ou les écarter avant de les intégrer au mémoire ou au CDCF.

1. **Alerte d'expiration d'offre** : notification automatique au chef de produit et au chef de département un certain temps avant qu'une offre publiée n'atteigne une date de fin planifiée, pour anticiper son renouvellement, sa mise à jour ou son retrait plutôt que de la laisser devenir obsolète sans action.

2. **Comparateur de versions d'offre côte à côte** : au-delà du simple diff texte déjà prévu (historique visuel), une vue qui affiche deux versions d'une même fiche côte à côte (texte + visuels), utile au chef de service et au chef de département pendant la validation.

3. **Tableau de bord de santé du catalogue** : un score global de complétude/qualité du catalogue (fiches incomplètes, médias manquants, règles non respectées, offres proches de l'expiration), visible par le chef de département en complément du taux de complétude déjà prévu.

4. **Journal de compatibilité multi-devices pour l'app mobile** : suivi des versions Flutter supportées et des retours utilisateurs terrain (les commerciaux/community managers pouvant travailler hors bureau), utile pour la partie exploitation/RUNBOOK du mémoire.

5. **Mode brouillon collaboratif avec verrouillage de fiche** : empêcher que deux acteurs modifient la même fiche en même temps (verrou optimiste ou pessimiste), pertinent puisque plusieurs acteurs successifs interviennent sur la même fiche.

6. **Suggestions de packs par similarité** : à la création d'un pack, suggérer des produits/services fréquemment associés dans des packs existants — complète la détection de doublons déjà prévue avec une aide à la composition.

7. **Traduction assistée du contenu marketing** : en Afrique de l'Ouest francophone, une option de génération de description en langues locales ou en anglais pour les offres à portée régionale, en plus du français — à évaluer selon si Moov Burkina en a réellement besoin.

8. **Simulateur d'impact avant publication** : à partir des données historiques de campagnes similaires, une estimation indicative (non garantie) de la portée attendue d'une offre avant sa publication, utile au chef de département pour la décision stratégique.

9. **Export CRM différentiel plutôt que complet** : ne renvoyer au CRM que ce qui a changé depuis la dernière synchronisation plutôt que la fiche complète à chaque fois, pour limiter la charge réseau — point technique plus que fonctionnel, à documenter comme optimisation possible.

10. **Journal des décisions stratégiques du chef de département** : lorsqu'il annule une offre déjà validée par le chef de service sur consigne de la direction, lui permettre de motiver cette décision par un commentaire obligatoire, conservé dans l'historique — renforce la traçabilité déjà prévue sur ce cas précis qui est aujourd'hui le seul point du workflow sans exigence explicite de justification.
