import { IPageFilters } from './pagination.models';

/** Un insumo de la receta y cuántas unidades del producto alcanza a fabricar con su stock */
export interface IProductionSupplyAvailability {
  supplyProductId: number;
  supplyProductName: string;
  supplyUnit: string | null;
  supplyUnitDecimalPlaces: number;
  quantityPerUnit: number;
  /** Stock del insumo en el almacén (0 si no tiene registro de inventario ahí) */
  stock: number;
  /** floor(max(stock, 0) / quantityPerUnit), o 0 si el insumo está inactivo */
  unitsPossible: number;
  isActive: boolean;
  /** true si este insumo es (uno de) los que limitan cuánto se puede fabricar */
  isLimiting: boolean;
}

/** Respuesta de GET /api/Production/availability: una fila por producto fabricado activo por almacén */
export interface IProductionAvailability {
  productId: number;
  productName: string;
  productSku: string | null;
  /** Unidad del producto fabricado: decide qué cantidades se pueden fabricar */
  productUnitAbbreviation: string;
  productUnitDecimalPlaces: number;
  warehouseId: number;
  warehouseName: string;
  /** Stock actual del producto fabricado en el almacén — tope para separar */
  currentStock: number;
  /** Mínimo de `unitsPossible` entre sus insumos; 0 si no tiene receta activa */
  maxProducible: number;
  companyId: number;
  supplies: IProductionSupplyAvailability[];
}

export interface IProductionAvailabilityFilters {
  warehouseId?: number;
  productId?: number;
}

/** "Production" = fabricar (salen insumos, entra producto); "Disassembly" = separar (al revés) */
export type ProductionOrderType = 'Production' | 'Disassembly';

/** Copia de la receta al momento de la operación: no cambia si después se edita la receta */
export interface IProductionOrderItem {
  supplyProductId: number;
  supplyProductName: string;
  supplyUnit: string | null;
  quantityPerUnit: number;
  totalQuantity: number;
}

/** Respuesta de GET /api/Production, GET /api/Production/{id}, POST /api/Production y /disassemble */
export interface IProductionOrder {
  id: number;
  /** Consecutivo por empresa */
  folioNumber: number;
  type: ProductionOrderType;
  productId: number;
  productName: string;
  productSku: string | null;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  notes: string | null;
  items: IProductionOrderItem[];
  companyId: number;
  createdAt: string;
  createdBy: string;
}

/** Body de POST /api/Production (fabricar) y POST /api/Production/disassemble (separar) */
export interface IProductionRequest {
  productId: number;
  warehouseId: number;
  quantity: number;
  notes?: string | null;
}

/** Query params opcionales de GET /api/Production. from/to son fechas (sin hora) */
export interface IProductionFilters extends IPageFilters {
  warehouseId?: number;
  productId?: number;
  type?: ProductionOrderType;
  from?: string;
  to?: string;
}

/** Cuerpo del 400 de POST /api/Production cuando no alcanza un insumo */
export interface IProductionStockErrorResponse {
  message: string;
  maxProducible: number;
  supplyProductId: number;
}

/** Cuerpo del 400 de POST /api/Production/disassemble cuando no hay stock suficiente del producto */
export interface IDisassemblyStockErrorResponse {
  message: string;
  currentStock: number;
}
