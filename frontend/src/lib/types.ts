export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  phone: string | null;
  pseudo: string | null;
  avatarUrl: string | null;
  role: string;
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

export interface CatalogItem {
  id: string;
  type: "PRODUCT" | "SERVICE" | "PACK";
  name: string;
  description: string;
  status: string;
  basePrice: number;
  currency: string;
  categoryId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  level: number;
  parentId: string | null;
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

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN_SYSTEME: "Administrateur Systeme",
  CHEF_PRODUIT: "Chef de Produit",
  ANALYSTE_MARKETING: "Analyste Marketing",
  CHEF_SERVICE: "Chef de Service",
  CHEF_DEPARTEMENT: "Chef de Departement",
  COMMUNITY_MANAGER: "Community Manager",
};
