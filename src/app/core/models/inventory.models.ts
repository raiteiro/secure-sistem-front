import { IPageFilters } from './pagination.models';

/** Respuesta de GET /api/Inventory y /api/Inventory/{id} */
export interface IInventoryItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  minStock: number | null;
  /** Ya viene calculado por el backend (quantity <= minStock, cuando minStock no es null) */
  isLowStock: boolean;
  companyId: number;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Query params opcionales de GET /api/Inventory */
export interface IInventoryFilters {
  productId?: number;
  warehouseId?: number;
  lowStockOnly?: boolean;
}

/** Body de POST /api/Inventory/{id}/min-stock. null quita la alerta. */
export interface IMinStockRequest {
  minStock: number | null;
}

/**
 * "Purchase" y "Return" se comportan como "In" (exigen quantity positiva) y "Sale" como "Out" (exige
 * quantity negativa) — son variantes semánticas para el ledger, la validación de signo es idéntica.
 * "Return" se genera automáticamente al procesar una devolución (POST /api/returns) y también está
 * disponible para registrar manualmente un movimiento (POST /api/InventoryMovements).
 */
export type InventoryMovementType = 'In' | 'Out' | 'Adjustment' | 'Purchase' | 'Sale' | 'Return';

/** Respuesta de GET /api/InventoryMovements y /api/InventoryMovements/{id} */
export interface IInventoryMovement {
  id: number;
  productId: number;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  type: InventoryMovementType;
  quantity: number;
  /** Stock que quedó justo después de este movimiento */
  resultingQuantity: number;
  notes: string | null;
  /** Solo relevante para type="Purchase" — de qué proveedor se recibió la mercancía */
  supplierId: number | null;
  supplierName: string | null;
  companyId: number;
  createdAt: string;
  createdBy: string;
}

/** Query params opcionales de GET /api/InventoryMovements. from/to son fechas (sin hora), filtran por CreatedAt */
export interface IInventoryMovementFilters extends IPageFilters {
  productId?: number;
  warehouseId?: number;
  from?: string;
  to?: string;
}

/** Body de POST /api/InventoryMovements. El signo de quantity debe coincidir con type (ver backend). */
export interface IInventoryMovementRequest {
  productId: number;
  warehouseId: number;
  type: InventoryMovementType;
  quantity: number;
  notes?: string | null;
  /** Opcional, solo aplica cuando type="Purchase" */
  supplierId?: number | null;
}
