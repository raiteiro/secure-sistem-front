import { IPageFilters } from './pagination.models';
import { PaymentMethod } from './sale.models';

/** Respuesta de GET /api/CashSessions, /api/CashSessions/current y /api/CashSessions/{id} */
export interface ICashSession {
  id: number;
  cashRegisterId: number;
  cashRegisterName: string;
  userId: number;
  /** El cajero dueño del turno (quien lo abrió) — mismo valor que createdBy */
  username: string;
  companyId: number;
  isOpen: boolean;
  openingAmount: number;
  closingAmount: number | null;
  /** Solo viene resuelto al cerrar: apertura + ventas en efectivo del turno */
  expectedAmount: number | null;
  /** closingAmount - expectedAmount, solo al cerrar */
  difference: number | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  /** Quien abrió el turno — mismo valor que username */
  createdBy: string;
  /** Quien lo cerró — null mientras siga abierto. Puede ser distinto de username/createdBy (cualquiera en la empresa puede cerrar un turno ajeno) */
  modifiedBy: string | null;
  /** Se llenan si este turno se reabrió alguna vez (aunque ya se haya vuelto a cerrar) */
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
}

/** Query params opcionales de GET /api/CashSessions. from/to son fechas (sin hora), filtran por openedAt */
export interface ICashSessionFilters extends IPageFilters {
  cashRegisterId?: number;
  isOpen?: boolean;
  from?: string;
  to?: string;
}

/** Body de POST /api/CashSessions/open */
export interface IOpenCashSessionRequest {
  cashRegisterId: number;
  openingAmount: number;
}

/** Body de POST /api/CashSessions/{id}/close */
export interface ICloseCashSessionRequest {
  closingAmount: number;
  notes?: string | null;
}

/** Body de POST /api/CashSessions/{id}/reopen */
export interface IReopenCashSessionRequest {
  reason: string;
}

/** Un renglón del listado de movimientos de GET /api/CashSessions/{id}/closeout */
export interface ICashSessionMovement {
  createdAt: string;
  customerName: string | null;
  folioNumber: number;
  method: PaymentMethod;
  /** Negativo cuando kind es 'Return' */
  amount: number;
  kind: 'Sale' | 'Return';
  /** 'Completed'/'Cancelled' (kind 'Sale') o 'Returned' (kind 'Return') */
  status: string;
}

export interface ICashSessionMethodTotal {
  method: PaymentMethod;
  count: number;
  subtotal: number;
}

/**
 * Respuesta de GET /api/CashSessions/{id}/closeout: detalle imprimible del corte de caja,
 * con el encabezado de empresa (igual que ISaleReceipt) y el desglose de movimientos/totales
 * por método de pago.
 */
export interface ICashSessionCloseout {
  cashSessionId: number;
  cashRegisterName: string;
  branchName: string;
  username: string;
  companyName: string;
  companyTaxId: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyLogoPath: string | null;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  expectedAmount: number | null;
  closingAmount: number | null;
  difference: number | null;
  movements: ICashSessionMovement[];
  totals: ICashSessionMethodTotal[];
  netTotal: number;
}
