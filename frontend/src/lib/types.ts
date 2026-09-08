export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sex: string | null;
  phone: string | null;
  pseudo: string | null;
  address: string | null;
  avatarUrl: string | null;
  role: string;
  /** Codes de permission du role, tels que renvoyes par le backend. */
  permissions: string[];
  status: string;
  forcePasswordChange: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  fingerprint: string;
  user: User;
}

/**
 * Premier niveau de classification : TYPE -> CATEGORIE -> SOUS-CATEGORIE -> ELEMENT.
 *
 * L'enumeration est figee cote serveur (com.moov.pim.catalog.domain.ItemType) :
 * le type determine quelle entite est creee, quel formulaire est presente et quel
 * circuit s'applique. PRODUCT, SERVICE et PACK sont des briques du catalogue ;
 * OFFER designe les offres commerciales du cycle de vie.
 */
export type ItemType = "PRODUCT" | "OFFER" | "SERVICE" | "PACK";

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PRODUCT: "Produit",
  OFFER: "Offre",
  SERVICE: "Service",
  PACK: "Pack",
};

export interface CatalogItem {
  id: string;
  type: "PRODUCT" | "SERVICE" | "PACK";
  name: string;
  description: string;
  status: string;
  basePrice: number;
  currency: string;
  categoryId: string | null;
  /** Chemin de classement lisible : « Équipements / Routeurs ». Null si non résolu. */
  categoryPath: string | null;
  createdAt: string;
  details: Record<string, unknown>;
  /**
   * Auteur de la brique, en clair. Null lorsque le compte connecte n'a pas a le
   * connaitre : le serveur ne le renseigne que pour les roles a vue transversale,
   * conformement aux regles de visibilite du cahier des charges.
   */
  createdByName: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  /** Type auquel la branche appartient. Une sous-catégorie hérite de celui de son parent. */
  type: ItemType;
  /** Libellé français du type, fourni par le serveur pour éviter une table de correspondance locale. */
  typeLabel: string;
  level: number;
  parentId: string | null;
  parentName: string | null;
  /**
   * Une catégorie désactivée reste lisible sur les fiches déjà classées mais
   * n'est plus proposée à la sélection. La désactivation remplace la suppression,
   * qui laisserait les éléments existants sans classement.
   */
  active: boolean;
  createdAt: string;
}

export interface Offer {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: OfferStatus;
  /** Catégorie ou sous-catégorie de type OFFRE. Null pour les offres antérieures à la classification. */
  categoryId: string | null;
  /** Chemin de classement lisible : « Internet mobile / Forfaits Data ». */
  categoryPath: string | null;
  promotionalPrice: number | null;
  currency: string;
  validFrom: string | null;
  validUntil: string | null;
  targetSegment: string | null;
  customerType: string | null;
  qualityScore: number;
  publishDate: string | null;
  legalMentions: string | null;
  createdById: string;
  enrichedById: string | null;
  /** Analyste designe pour l'enrichissement ; null tant que l'offre n'est pas repartie. */
  assignedToId: string | null;
  /**
   * Auteur de la fiche, en clair. Null lorsque le compte connecte n'a pas a le
   * connaitre : le serveur ne le renseigne que pour les roles a vue transversale
   * qui prennent part au circuit, conformement aux regles de visibilite du cahier
   * des charges. Ne jamais retomber sur createdById pour l'afficher.
   */
  createdByName: string | null;
  /** Analyste designe, en clair. Meme regle de divulgation que l'auteur. */
  assignedToName: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  catalogItemIds: string[];
}

export type OfferStatus =
  | "DRAFT"
  | "IN_ENRICHMENT"
  | "IN_VALIDATION"
  | "VALIDATED"
  | "PLANNED"
  | "PUBLISHED"
  | "SUSPENDED"
  | "OBSOLETE"
  | "WITHDRAWN"
  | "ARCHIVED";

export interface Campaign {
  id: string;
  name: string;
  offerId: string;
  /**
   * Visuel accompagnant la diffusion, choisi par le community manager parmi
   * ceux déjà rattachés à l'offre et déjà approuvés. Nul pour une campagne
   * purement textuelle — SMS, USSD.
   */
  mediaAssetId: string | null;
  status: string;
  scheduledAt: string | null;
  createdById: string;
  createdAt: string;
  channels: CampaignChannel[];
}

export interface CampaignChannel {
  id: string;
  channelType: string;
  message: string;
  status: string;
  sentAt: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  /**
   * Offre à l'origine de la notification. Le serveur la renvoie depuis
   * l'origine ; elle manquait ici, si bien que l'écran ne pouvait pas conduire
   * à la fiche concernée — « Offre rejetée » obligeait à la retrouver à la main.
   * Nulle pour une notification qui ne porte sur aucune offre.
   */
  relatedOfferId: string | null;
  createdAt: string;
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Brouillon",
  IN_ENRICHMENT: "En enrichissement",
  IN_VALIDATION: "En validation",
  VALIDATED: "Validée",
  PLANNED: "Planifiée",
  PUBLISHED: "Publiée",
  SUSPENDED: "Suspendue",
  OBSOLETE: "Obsolète",
  WITHDRAWN: "Retirée",
  ARCHIVED: "Archivée",
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  IN_ENRICHMENT: "bg-blue-100 text-blue-700",
  IN_VALIDATION: "bg-yellow-100 text-yellow-700",
  VALIDATED: "bg-green-100 text-green-700",
  PLANNED: "bg-purple-100 text-purple-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  OBSOLETE: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export interface AuditLog {
  id: string;
  userId: string;
  /** Nom de l'auteur, resolu par le serveur ; null pour une action systeme. */
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  ruleType: string;
  active: boolean;
  sourceItemId: string;
  targetItemId: string;
  createdById: string;
  createdAt: string;
  /** La violation empeche-t-elle l enregistrement ? Ajoute par la migration V042. */
  blocking: boolean;
}

export interface NotificationConfig {
  id: string;
  type: string;
  channel: string;
  enabled: boolean;
  updatedById: string;
  updatedAt: string;
}

export interface KpiConfig {
  id: string;
  kpiCode: string;
  label: string;
  enabled: boolean;
  thresholdExpression: string | null;
  updatedById: string;
  updatedAt: string;
}

export interface KpiEvent {
  id: string;
  offerId: string;
  /** Nom de l'offre, resolu par le serveur ; null si elle a ete supprimee. */
  offerName: string | null;
  eventType: string;
  actorId: string;
  /** Nom de l'acteur, resolu par le serveur ; null si le compte a disparu. */
  actorName: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface AbTest {
  id: string;
  offerId: string;
  variantA: string;
  variantB: string;
  metric: string;
  status: string;
  winner: string | null;
  createdById: string;
  createdAt: string;
}

/**
 * Une diffusion vers un systeme tiers.
 *
 * Les champs de tracabilite sont ce qui distingue un statut constate d'un statut
 * affirme : `httpStatus` est le code renvoye par le destinataire quand la fiche
 * lui a ete poussee, `consumedAt` la date a laquelle il est venu la lire quand
 * elle est restee a sa disposition. Un succes sans l'un ni l'autre n'aurait
 * aucune preuve derriere lui.
 */
export interface IntegrationExport {
  id: string;
  targetSystem: string;
  offerId: string;
  exportType: string;
  status: string;
  /** PUSH : la plateforme a appele le systeme. PULL : elle a mis la fiche a disposition. */
  deliveryMode: string | null;
  endpointUrl: string | null;
  httpStatus: number | null;
  consumedAt: string | null;
  consumedCount: number;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  completedAt: string | null;
}

/** Adresse a laquelle la plateforme pousse les fiches d'un systeme destinataire. */
export interface IntegrationEndpoint {
  targetSystem: string;
  url: string | null;
  active: boolean;
  /** Vrai quand la remise HTTP est reellement possible : actif et URL renseignee. */
  reachable: boolean;
  updatedById: string | null;
  updatedAt: string;
}

/**
 * Cle remise a un systeme tiers pour interroger le flux des offres publiees.
 *
 * `keyPrefix` est le debut de la cle, conserve en clair pour la reconnaitre dans
 * une liste ; la valeur complete n'existe qu'une fois, a la creation.
 * `lastUsedAt` et `callCount` disent si le systeme consomme reellement le flux :
 * une cle creee mais jamais utilisee signale un raccordement qui n'a pas abouti.
 */
export interface IntegrationApiKey {
  id: string;
  label: string;
  targetSystem: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  callCount: number;
  revokedAt: string | null;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN_SYSTEME: "Administrateur Systeme",
  CHEF_PRODUIT: "Chef de Produit",
  ANALYSTE_MARKETING: "Analyste Marketing",
  CHEF_SERVICE: "Chef de Service",
  CHEF_DEPARTEMENT: "Chef de Departement",
  COMMUNITY_MANAGER: "Community Manager",
};
