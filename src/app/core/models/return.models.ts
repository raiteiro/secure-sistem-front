import { PaymentMethod } from './sale.models';
import { IPageFilters } from './pagination.models';

/** POST /api/returns solo acepta estos tres métodos de reembolso */
export type RefundMethod = PaymentMethod;

export interface IReturnItemRequest {
  saleItemId: number;
  quantity: number;
}

/**
 * Body de POST /api/returns. `cashSessionId` es el turno ACTUAL de quien procesa la devolución
 * (no el original de la venta — puede ser días después).
 */
export interface IReturnRequest {
  saleId: number;
  cashSessionId: number;
  refundMethod: RefundMethod;
  reason: string | null;
  items: IReturnItemRequest[];
}

export interface IReturnItem {
  id: number;
  saleItemId: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  taxRateValue: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** Respuesta de POST /api/returns, GET /api/returns y GET /api/returns/{id} */
export interface IReturn {
  id: number;
  saleId: number;
  saleFolioNumber: number;
  warehouseId: number;
  warehouseName: string;
  cashSessionId: number;
  userId: number;
  username: string;
  refundMethod: RefundMethod;
  reason: string | null;
  subtotalRefunded: number;
  taxRefunded: number;
  totalRefunded: number;
  items: IReturnItem[];
  companyId: number;
  createdAt: string;
  createdBy: string;
}

/** Query params opcionales de GET /api/returns. from/to son fechas (sin hora), filtran por CreatedAt */
export interface IReturnFilters extends IPageFilters {
  saleId?: number;
  cashSessionId?: number;
  from?: string;
  to?: string;
}
