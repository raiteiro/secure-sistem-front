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
