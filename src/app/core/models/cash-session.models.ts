import { IPageFilters } from './pagination.models';

/**
 * Respuesta de GET /api/CashSessions, /api/CashSessions/current y /api/CashSessions/{id}.
 * El spec del backend no incluyó un ejemplo de JSON completo para este endpoint (solo los bodies
 * de abrir/cerrar y qué campos trae el cierre) — los nombres de openedAt/openedBy/closedAt/closedBy
 * se infirieron siguiendo el patrón createdAt/createdBy/modifiedAt/modifiedBy del resto de módulos.
 * Verificar contra la respuesta real y ajustar si el backend usa otros nombres.
 */
export interface ICashSession {
  id: number;
  cashRegisterId: number;
  cashRegisterName: string;
  companyId: number;
  isOpen: boolean;
  openingAmount: number;
  closingAmount: number | null;
  /** Solo viene resuelto al cerrar. Por ahora solo considera el monto de apertura (Sale aún no existe) */
  expectedAmount: number | null;
  /** closingAmount - expectedAmount, solo al cerrar */
  difference: number | null;
  notes: string | null;
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
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
