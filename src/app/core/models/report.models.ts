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

/** Query params opcionales de GET /api/reports/top-products. limit entre 1 y 100 (default 10) */
export interface ITopProductsFilters {
  from?: string;
  to?: string;
  branchId?: number;
  limit?: number;
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
 * (solo reconcilian efectivo); cardSalesTotal/otherSalesTotal son extra para ver el total real vendido por método.
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
  cardSalesTotal: number;
  otherSalesTotal: number;
  refundsTotal: number;
  expectedAmount: number;
  closingAmount: number;
  difference: number;
}
