export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  fingerprint: string;
  user: User;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN_SYSTEME: "Administrateur Système",
  CHEF_PRODUIT: "Chef de Produit",
  ANALYSTE_MARKETING: "Analyste Marketing",
  CHEF_SERVICE: "Chef de Service",
  CHEF_DEPARTEMENT: "Chef de Département",
  COMMUNITY_MANAGER: "Community Manager",
};
