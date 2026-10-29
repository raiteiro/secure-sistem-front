export interface IUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
  roleName?: string;
  /** Sucursal asignada — si no está, puede abrir turno en cualquier caja de su empresa */
  branchId?: number;
  branchName?: string;
  /** Si es true, puede cambiar entre su empresa y las que le asigne un admin de sistema (ver /company-access) */
  canSwitchCompany?: boolean;
  isActive?: boolean;
  companyId?: number;
  mustChangePassword?: boolean;
}

export interface ICreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
  /** Opcional. Si se asigna, el usuario solo podrá abrir turno en cajas de esa sucursal */
  branchId?: number;
  /** Solo admin de sistema: crea el usuario en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}

export interface IUpdateUserRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
  /** Opcional. Omitir/null quita la asignación */
  branchId?: number;
}

/** Body para POST /api/users/{id}/reassign-company (solo admin de sistema) */
export interface IReassignCompanyRequest {
  companyId: number;
  roleId: number;
}

/** Respuesta de POST /api/users/{id}/reset-password */
export interface IResetUserPasswordResponse {
  message: string;
  temporaryPassword: string;
}

/** Una empresa+rol adicional asignado al usuario, dentro de GET/POST /api/users/{id}/company-access */
export interface IUserCompanyGrant {
  companyId: number;
  companyName?: string;
  roleId: number;
  roleName?: string;
}

/** Respuesta de GET /api/users/{id}/company-access (solo admin de sistema) */
export interface IUserCompanyAccess {
  canSwitchCompany: boolean;
  grants: IUserCompanyGrant[];
}

/** Body de POST /api/users/{id}/company-access: reemplaza todas las empresas adicionales asignadas (solo admin de sistema) */
export interface ISetUserCompanyAccessRequest {
  canSwitchCompany: boolean;
  grants: { companyId: number; roleId: number }[];
}
