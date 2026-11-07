import { PaymentMethod } from './sale.models';

export type ReportGroupBy = 'day' | 'month';

/** Query params opcionales de GET /api/reports/sales-by-period. Sin from/to → mes en curso a la fecha */
export interface ISalesByPeriodFilters {
  from?: string;
  to?: string;
  branchId?: number;
  groupBy?: ReportGroupBy;
}

export interface ISalesByPeriodEntry {
  period: string;
  salesCount: number;
  totalAmount: number;
  /** Todos los productos vendidos en este periodo (no top N), desc por quantitySold. Mismo shape que /reports/top-products */
  products: ITopProduct[];
}

/** Respuesta de GET /api/reports/sales-by-period */
export interface ISalesByPeriodReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  periods: ISalesByPeriodEntry[];
  totalSalesCount: number;
  totalAmount: number;
}

/** Query params opcionales de GET /api/reports/top-products ("Ventas por producto") */
export interface ITopProductsFilters {
  from?: string;
  to?: string;
  branchId?: number;
}

/**
 * Item de la respuesta de GET /api/reports/top-products, ordenada desc por quantitySold.
 * Mismo shape anidado en products[] de /reports/sales-by-period.
 */
export interface ITopProduct {
  productId: number;
  productName: string;
  sku: string | null;
  quantitySold: number;
  /** Ya incluye taxAmount, no se suman aparte */
  revenue: number;
  /**
   * Antes de descuento/impuesto, igual que SaleItem.UnitPrice. Si el precio de catálogo cambió a mitad
   * del rango, es un promedio ponderado por cantidad (Σ(unitPrice × quantity) / Σquantity), no Product.Price actual.
   */
  unitPrice: number;
  /** IVA cobrado (suma de SaleItem.TaxAmount), ya incluido dentro de revenue */
  taxAmount: number;
}

/** Query params opcionales de GET /api/reports/cashier-closeouts. from/to filtran por closedAt */
export interface ICashierCloseoutFilters {
  from?: string;
  to?: string;
  userId?: number;
  branchId?: number;
}

/**
 * Item de la respuesta de GET /api/reports/cashier-closeouts.
 * expectedAmount/closingAmount/difference son los mismos que calculó CashSessionsController.Close al cerrar el turno
 * (solo reconcilian efectivo); debitSalesTotal/creditSalesTotal/transferSalesTotal/cardSalesTotal/otherSalesTotal son
 * extra para ver el total real vendido por método. cardSalesTotal solo trae datos en cortes anteriores a separar
 * débito/crédito — en cortes nuevos siempre es 0.
 */
export interface ICashierCloseout {
  cashSessionId: number;
  userId: number;
  username: string;
  cashRegisterId: number;
  cashRegisterName: string;
  branchId: number;
  branchName: string;
  openedAt: string;
  closedAt: string;
  salesCount: number;
  openingAmount: number;
  cashSalesTotal: number;
  debitSalesTotal: number;
  creditSalesTotal: number;
  transferSalesTotal: number;
  cardSalesTotal: number;
  otherSalesTotal: number;
  refundsTotal: number;
  expectedAmount: number;
  closingAmount: number;
  difference: number;
}

/** Query params opcionales de GET /api/reports/sales-detail. Sin from/to → mes en curso a la fecha */
export interface ISalesDetailFilters {
  from?: string;
  to?: string;
  branchId?: number;
}

export interface ISalesDetailProductRow {
  productId: number;
  productName: string;
  quantity: number;
  /** Total cobrado (subtotal + impuesto) */
  amount: number;
}

export interface ISalesDetailCategoryGroup {
  /** 0 = bucket sintético "Sin categoría" */
  categoryId: number;
  categoryName: string;
  quantity: number;
  amount: number;
  products: ISalesDetailProductRow[];
}

export interface ISalesDetailTaxRow {
  /** "Exento" si la tasa es 0, si no "16%" etc. */
  label: string;
  taxAmount: number;
  amount: number;
}

export interface ISalesDetailPaymentRow {
  method: PaymentMethod;
  amount: number;
}

export interface ISalesDetailSessionRow {
  username: string;
  expectedAmount: number | null;
  closingAmount: number | null;
  difference: number | null;
}

/**
 * Respuesta de GET /api/reports/sales-detail: reporte combinado — productos vendidos por
 * categoría, desglose de impuestos, desglose por forma de pago, uso de descuentos y control
 * de sesión (esperado/contado/diferencia por cajero cerrado en el rango).
 */
export interface ISalesDetailReport {
  from: string;
  to: string;
  categories: ISalesDetailCategoryGroup[];
  totalQuantity: number;
  totalAmount: number;
  /** Número de ventas (no de líneas) en el rango, excluyendo canceladas */
  transactionsCount: number;
  taxes: ISalesDetailTaxRow[];
  payments: ISalesDetailPaymentRow[];
  paymentsTotal: number;
  discountsCount: number;
  discountsTotal: number;
  sessions: ISalesDetailSessionRow[];
}

/** Query params opcionales de GET /api/reports/sales-by-ticket. Sin from/to → mes en curso a la fecha */
export interface ISalesByTicketFilters {
  from?: string;
  to?: string;
  branchId?: number;
}

export interface ISalesByTicketProductRow {
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  /** Suma de precios de los extras seleccionados × cantidad — ya incluido en subtotal */
  extrasTotal: number;
  extras: ISalesByTicketExtraRow[];
  total: number;
}

export interface ISalesByTicketExtraRow {
  extraName: string;
  /** Snapshot por unidad — para el total de este extra en la línea, multiplicar por quantity */
  price: number;
}

export interface ISalesByTicketPaymentRow {
  method: PaymentMethod;
  amount: number;
}

export interface ISalesByTicketRow {
  saleId: number;
  folioNumber: number;
  createdAt: string;
  branchName: string;
  /** Cajero que cobró la venta */
  username: string;
  customerName: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  items: ISalesByTicketProductRow[];
  payments: ISalesByTicketPaymentRow[];
}

/** Respuesta de GET /api/reports/sales-by-ticket: una venta por fila, con sus líneas y pagos */
export interface ISalesByTicketReport {
  from: string;
  to: string;
  tickets: ISalesByTicketRow[];
  ticketsCount: number;
  totalAmount: number;
}
