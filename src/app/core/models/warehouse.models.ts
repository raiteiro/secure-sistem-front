/** Respuesta de GET /api/Warehouses y /api/Warehouses/{id} */
export interface IWarehouse {
  id: number;
  name: string;
  address: string | null;
  companyId: number;
  /** null = almacén independiente/central, no ligado a ninguna sucursal */
  branchId: number | null;
  /** Resuelto por el backend, listo para mostrar */
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Warehouses y POST /api/Warehouses/{id}/update */
export interface IWarehouseRequest {
  name: string;
  address: string | null;
  /** Si se manda, el almacén queda ligado a esa sucursal (debe ser de la misma empresa). Si se omite/null, es independiente. */
  branchId?: number | null;
  /** Solo admin de sistema, solo cuando no se manda branchId: crea el almacén independiente en otra empresa. */
  companyId?: number;
}
