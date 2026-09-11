export interface IUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
  roleName?: string;
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
