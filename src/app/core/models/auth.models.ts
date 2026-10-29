/** Request para POST /api/Auth/login */
export interface ILoginRequest {
  username: string;
  password: string;
}

/** Respuesta del login con JWT, refresh token e info del usuario */
export interface ILoginResponse {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: IUser;
}

/** Request para POST /api/Auth/refresh y POST /api/Auth/logout */
export interface IRefreshTokenRequest {
  refreshToken: string;
}

/** Request para POST /api/Auth/switch-company */
export interface ISwitchCompanyRequest {
  companyId: number;
}

/**
 * Respuesta de GET /api/Auth/my-companies: empresas en las que el usuario puede estar activo
 * ahora mismo — la propia (siempre primero, isHome=true) más las que le haya asignado un
 * admin de sistema vía /api/Users/{id}/company-access, si tiene canSwitchCompany=true.
 */
export interface IMyCompanyOption {
  companyId: number;
  companyName: string;
  roleId: number;
  roleName: string;
  isHome: boolean;
}

/** Info del usuario autenticado */
export interface IUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: number;
  roleName: string;
  companyId: number;
  companyName: string;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
}

/** Request para POST /api/Auth/change-password */
export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Request para POST /api/Auth/forgot-password */
export interface IForgotPasswordRequest {
  email: string;
}

/** Request para POST /api/Auth/reset-password */
export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
}
