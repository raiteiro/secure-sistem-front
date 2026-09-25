/** Respuesta de GET /api/Categories y /api/Categories/{id} */
export interface ICategory {
  id: number;
  name: string;
  description: string | null;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Categories y POST /api/Categories/{id}/update */
export interface ICategoryRequest {
  name: string;
  description?: string | null;
  /** Solo admin de sistema: crea la categoría en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
