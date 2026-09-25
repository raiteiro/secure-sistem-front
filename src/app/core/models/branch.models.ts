/** Respuesta de GET /api/Branches y /api/Branches/{id} */
export interface IBranch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Branches y POST /api/Branches/{id}/update */
export interface IBranchRequest {
  name: string;
  address: string | null;
  phone: string | null;
  /** Solo admin de sistema: crea la sucursal en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
