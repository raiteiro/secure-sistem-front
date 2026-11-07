/** Respuesta de GET /api/ProductExtras y /api/ProductExtras/{id} */
export interface IProductExtra {
  id: number;
  name: string;
  price: number;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/ProductExtras y POST /api/ProductExtras/{id}/update */
export interface IProductExtraRequest {
  name: string;
  price: number;
  /** Solo admin de sistema: crea el extra en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
