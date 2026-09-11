/** Respuesta de GET /api/Companies y /api/Companies/{id} */
export interface ICompany {
  id: number;
  name: string;
  taxId: string;
  isActive: boolean;
  maxUsers: number | null;
  maxConcurrentSessions: number | null;
  activeUserCount: number;
  activeSessionCount: number;
  subscriptionExpiresAt: string | null;
  /** Id de una de las paletas fijas en core/constants/color-presets.ts. null = paleta "purple" (default) */
  colorPreset: string | null;
  /** Texto libre para membrete */
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** URL. Nota de casing: así vienen del backend (serialización .NET), no camelCase "estándar" */
  instagram: string | null;
  facebook: string | null;
  tikTok: string | null;
  /** Texto libre (número de contacto), no es URL */
  whatsApp: string | null;
  /** Solo lectura: se llena vía POST /api/Companies/{id}/logo. Ruta relativa, ej. "/uploads/companies/3/logo.png" */
  logoPath: string | null;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Companies y POST /api/Companies/{id}/update */
export interface ICompanyRequest {
  name: string;
  taxId: string;
  maxUsers: number | null;
  maxConcurrentSessions: number | null;
  subscriptionExpiresAt: string | null;
  colorPreset: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tikTok: string | null;
  whatsApp: string | null;
}

/** Respuesta de POST /api/Companies/{id}/logo */
export interface ICompanyLogoResponse {
  logoPath: string;
}
