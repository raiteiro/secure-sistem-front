import { IPageFilters } from './pagination.models';
import { ProductKind } from './product.models';

/** Respuesta de GET /api/Inventory y /api/Inventory/{id} (nunca incluye combos) */
export interface IInventoryItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  /** Separa las pestañas Productos / Insumos del almacén */
  productKind: ProductKind;
  isManufactured: boolean;
  /** Unidad del producto: decide el `step` y la validación de movimientos, entradas y stock mínimo */
  unitAbbreviation: string;
  unitDecimalPlaces: number;
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

/**
 * Un combo no tiene stock propio (la venta descuenta sus componentes) — GET /api/Inventory ya no
 * los devuelve. Su disponibilidad se calcula en GET /api/Inventory/combo-availability.
 */
export interface IComboComponentAvailability {
  componentProductId: number;
  componentProductName: string;
  quantityPerCombo: number;
  /** Stock del componente en el almacén (0 si no tiene registro de inventario ahí) */
  stock: number;
  /** floor(max(stock, 0) / quantityPerCombo), o 0 si el componente está inactivo */
  combosPossible: number;
  isActive: boolean;
  /** true si este componente es (uno de) los que limitan cuántos combos se pueden vender */
  isLimiting: boolean;
}

/** Cuántos combos se pueden vender desde un almacén con el stock actual de sus componentes. Solo informativo */
export interface IComboAvailability {
  comboProductId: number;
  comboProductName: string;
  comboProductSku: string | null;
  warehouseId: number;
  warehouseName: string;
  /** Mínimo de `combosPossible` entre sus componentes activos; 0 si no tiene componentes activos */
  availableQuantity: number;
  companyId: number;
  components: IComboComponentAvailability[];
}

/** Query params opcionales de GET /api/Inventory/combo-availability */
export interface IComboAvailabilityFilters {
  warehouseId?: number;
  productId?: number;
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
export type InventoryMovementType =
  | 'In'
  | 'Out'
  | 'Adjustment'
  | 'Purchase'
  | 'Sale'
  | 'Return'
  | 'Production'
  | 'Disassembly';

/**
 * Tipos que se pueden registrar a mano en POST /api/InventoryMovements. "Production"/"Disassembly"
 * solo los genera /api/Production (el backend los rechaza en movimientos manuales).
 */
export type ManualInventoryMovementType = Exclude<InventoryMovementType, 'Production' | 'Disassembly'>;

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
  /** Orden de producción que generó el movimiento (type Production/Disassembly); null en el resto */
  productionOrderId: number | null;
  companyId: number;
  createdAt: string;
  createdBy: string;
}

/** Query params opcionales de GET /api/InventoryMovements. from/to son fechas (sin hora), filtran por CreatedAt */
export interface IInventoryMovementFilters extends IPageFilters {
  productId?: number;
  warehouseId?: number;
  productionOrderId?: number;
  from?: string;
  to?: string;
}

/** Body de POST /api/InventoryMovements. El signo de quantity debe coincidir con type (ver backend). */
export interface IInventoryMovementRequest {
  productId: number;
  warehouseId: number;
  type: ManualInventoryMovementType;
  quantity: number;
  notes?: string | null;
  /** Opcional, solo aplica cuando type="Purchase" */
  supplierId?: number | null;
}
