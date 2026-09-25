/** Respuesta de GET /api/Suppliers y /api/Suppliers/{id} */
export interface ISupplier {
  id: number;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Si es true, se le puede asignar como consignador a un producto (ver product.models.ts) */
  isConsignor: boolean;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Suppliers y POST /api/Suppliers/{id}/update */
export interface ISupplierRequest {
  name: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isConsignor: boolean;
  /** Solo admin de sistema: crea el proveedor en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
