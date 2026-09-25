/** Respuesta de GET /api/CashRegisters y /api/CashRegisters/{id} */
export interface ICashRegister {
  id: number;
  name: string;
  branchId: number;
  branchName: string;
  companyId: number;
  isActive: boolean;
  /** Si es true, tiene un turno abierto ahora mismo — no se puede desactivar */
  hasOpenSession: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/CashRegisters y POST /api/CashRegisters/{id}/update */
export interface ICashRegisterRequest {
  name: string;
  branchId: number;
}
