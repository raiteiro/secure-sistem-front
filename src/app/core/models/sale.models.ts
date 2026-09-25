import { IPageFilters } from './pagination.models';

export type PaymentMethod = 'Cash' | 'Card' | 'Other';

// ===== Request (POST /api/Sales) =====
export interface ISaleItemRequest {
  productId: number;
  quantity: number;
  discountAmount: number;
}

export interface ISalePaymentRequest {
  method: PaymentMethod;
  amount: number;
}

export interface ISaleRequest {
  branchId: number;
  warehouseId: number;
  cashSessionId: number;
  customerId: number | null;
  items: ISaleItemRequest[];
  payments: ISalePaymentRequest[];
}

/**
 * Respuesta de POST /api/Sales, GET /api/Sales y GET /api/Sales/{id}.
 * El spec confirmó folioNumber + totales (subtotal/discountTotal/taxTotal/total) y que items/payments
 * vienen expandidos, pero no dio el JSON completo — nombres de campo abajo inferidos siguiendo el
 * patrón resuelto (branchName/warehouseName/customerName) del resto del backend. Verificar y ajustar
 * si el backend real usa otros nombres.
 */
export interface ISaleItem {
  /** Id de la línea (SaleItem.Id) — es el `saleItemId` que exige POST /api/Returns */
  id: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ISalePayment {
  method: PaymentMethod;
  amount: number;
}

export interface ISale {
  id: number;
  folioNumber: number;
  companyId: number;
  branchId: number;
  branchName: string | null;
  warehouseId: number;
  warehouseName: string | null;
  cashSessionId: number;
  customerId: number | null;
  customerName: string | null;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  items: ISaleItem[];
  payments: ISalePayment[];
  createdAt: string;
  createdBy: string;
}

/**
 * Query params opcionales de GET /api/Sales.
 * from/to son fechas (sin hora), filtran por CreatedAt y to incluye el día completo.
 * Si from es posterior a to, el backend responde 400.
 */
export interface ISaleFilters extends IPageFilters {
  branchId?: number;
  customerId?: number;
  cashSessionId?: number;
  status?: string;
  from?: string;
  to?: string;
}

/** `Sale.Status` — 'Completed' es el único estado sobre el que se puede devolver o cancelar. */
export type SaleStatus = 'Completed' | 'Cancelled';

/** Respuesta de GET /api/Sales/{id}/receipt — trae el encabezado de empresa que GET /api/Sales/{id} no incluye */
export interface ISaleReceipt {
  saleId: number;
  folioNumber: number;
  createdAt: string;
  status: string;
  companyName: string;
  companyTaxId: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyLogoPath: string | null;
  branchName: string | null;
  cashierUsername: string;
  customerName: string | null;
  customerEmail: string | null;
  items: ISaleItem[];
  payments: ISalePayment[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Body opcional de POST /api/Sales/{id}/cancel.
 * Si el usuario logueado ya tiene SALES.CANCEL (o es system admin), se puede cancelar sin body.
 * Si no lo tiene: sin body o con algún campo vacío → 401/403, ver `ICancelSaleErrorResponse`.
 */
export interface ICancelSaleRequest {
  supervisorUsername: string;
  supervisorPassword: string;
}

/**
 * Body de error de POST /api/Sales/{id}/cancel cuando falta autorización de supervisor.
 * `requiresSupervisorApproval: true` es la señal para mostrar el prompt de usuario/contraseña en
 * vez de tratarlo como error genérico — solo viene en el 403 por falta de permiso sin body/incompleto,
 * no en el 401 de credenciales incorrectas ni en el 403 de "el supervisor tampoco tiene permiso".
 */
export interface ICancelSaleErrorResponse {
  message: string;
  requiresSupervisorApproval?: boolean;
}

/** Body de POST /api/Sales/{id}/send-receipt. Si se omite `email`, el backend usa el del cliente de la venta. */
export interface ISendReceiptRequest {
  email?: string;
}

export interface ISendReceiptResponse {
  message: string;
}
