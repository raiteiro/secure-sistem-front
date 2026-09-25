import { IPageFilters } from './pagination.models';

/** Item de GET /api/Consignment/balances: cuánto se le debe a cada consignador ahora mismo */
export interface IConsignmentBalance {
  supplierId: number;
  supplierName: string;
  pendingSalesCount: number;
  pendingAmount: number;
}

/** Query params opcionales de GET /api/Consignment/sales. from/to son fechas (sin hora), filtran por CreatedAt */
export interface IConsignmentSaleFilters extends IPageFilters {
  supplierId?: number;
  pending?: boolean;
  from?: string;
  to?: string;
}

/**
 * Item de GET /api/Consignment/sales: bitácora de ventas de artículos consignados.
 * El backend no compartió el JSON completo — nombres inferidos siguiendo el patrón del resto de
 * módulos (saleId/saleFolioNumber, productId/productName, commissionAmount = lo que le toca al
 * consignador de esa línea). Verificar contra la respuesta real y ajustar si el backend usa otros.
 */
export interface IConsignmentSale {
  id: number;
  saleId: number;
  saleFolioNumber: number;
  supplierId: number;
  supplierName: string;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  /** Monto de la venta correspondiente a este artículo (antes de comisión) */
  saleAmount: number;
  /** Lo que le corresponde al consignador después de aplicar su comisión */
  payableAmount: number;
  /** true si ya quedó cubierto por un settlement */
  isSettled: boolean;
  settlementId: number | null;
  createdAt: string;
}

/** Body de POST /api/Consignment/settlements: liquida de un golpe todo lo pendiente de un proveedor */
export interface ICreateSettlementRequest {
  supplierId: number;
  notes?: string | null;
}

/** Query params opcionales de GET /api/Consignment/settlements. from/to son fechas (sin hora), filtran por CreatedAt */
export interface IConsignmentSettlementFilters extends IPageFilters {
  from?: string;
  to?: string;
}

/** Item de GET /api/Consignment/settlements (historial, sin detalle de ventas) */
export interface IConsignmentSettlement {
  id: number;
  supplierId: number;
  supplierName: string;
  salesCount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  createdBy: string;
}

/** Respuesta de GET /api/Consignment/settlements/{id}: detalle con las ventas que cubrió */
export interface IConsignmentSettlementDetail extends IConsignmentSettlement {
  sales: IConsignmentSale[];
}
