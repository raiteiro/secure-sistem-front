/** Respuesta de GET /api/TaxRates y /api/TaxRates/{id} */
export interface ITaxRate {
  id: number;
  name: string;
  /** Fracción (0 a 1), ej. 0.16 = 16% */
  rate: number;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/TaxRates y POST /api/TaxRates/{id}/update */
export interface ITaxRateRequest {
  name: string;
  /** Fracción (0 a 1), no porcentaje — 16% se manda como 0.16 */
  rate: number;
  /** Solo admin de sistema: crea el impuesto en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
