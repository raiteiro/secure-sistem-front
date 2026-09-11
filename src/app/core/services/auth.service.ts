import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, finalize, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ILoginRequest,
  ILoginResponse,
  IUser,
  IChangePasswordRequest,
  IRefreshTokenRequest,
  IForgotPasswordRequest,
  IResetPasswordRequest
} from '../models/auth.models';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const EXPIRES_AT_KEY = 'auth_expires_at';
const LOGOUT_REASON_KEY = 'auth_logout_reason';

/** Margen de seguridad para refrescar el token antes de que expire */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/Auth`;

  private _token = signal<string | null>(this.loadToken());
  private _currentUser = signal<IUser | null>(this.loadUser());
  private _refreshToken: string | null = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight$: Observable<ILoginResponse> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole = computed(() => this._currentUser()?.roleName ?? '');
  readonly isSystemAdmin = computed(() => this._currentUser()?.isSystemAdmin ?? false);
  readonly mustChangePassword = computed(() => this._currentUser()?.mustChangePassword ?? false);

  constructor() {
    const expiresAt = sessionStorage.getItem(EXPIRES_AT_KEY);
    if (this._token() && expiresAt) {
      this.scheduleRefresh(expiresAt);
    }
  }

  get token(): string | null {
    return this._token();
  }

  login(credentials: ILoginRequest): Observable<ILoginResponse> {
    return this.http.post<ILoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.applySession(response))
    );
  }

  /** Renueva el access token. Comparte una única llamada en curso entre todos los que la disparen a la vez. */
  refresh(): Observable<ILoginResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const request: IRefreshTokenRequest = { refreshToken: this._refreshToken ?? '' };
    this.refreshInFlight$ = this.http.post<ILoginResponse>(`${this.apiUrl}/refresh`, request).pipe(
      tap((response) => this.applySession(response)),
      catchError((error: HttpErrorResponse) => {
        this.logout(error.error?.message);
        return throwError(() => error);
      }),
      finalize(() => { this.refreshInFlight$ = null; }),
      shareReplay(1)
    );
    return this.refreshInFlight$;
  }

  me(): Observable<IUser> {
    return this.http.get<IUser>(`${this.apiUrl}/me`).pipe(
      tap((user) => {
        this._currentUser.set(user);
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  changePassword(request: IChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/change-password`, request).pipe(
      tap(() => {
        // El backend limpia el flag al cambiar la contraseña con éxito; reflejarlo localmente
        // evita depender de un GET /me extra para desbloquear la navegación.
        const user = this._currentUser();
        if (user) {
          const updated = { ...user, mustChangePassword: false };
          this._currentUser.set(updated);
          sessionStorage.setItem(USER_KEY, JSON.stringify(updated));
        }
      })
    );
  }

  /** Siempre responde 200 exista o no el email (evita confirmar qué correos están registrados) */
  forgotPassword(request: IForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, request);
  }

  /** Cambia la contraseña con el token del correo. El backend ya revoca las sesiones activas del usuario. */
  resetPassword(request: IResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, request);
  }

  /** Cierra sesión. `reason` (ej. mensaje de 402/403) se muestra en la pantalla de login. */
  logout(reason?: string): void {
    const refreshToken = this._refreshToken;
    this.clearSession();
    if (reason) {
      sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
    }
    this.router.navigate(['/login']);

    if (refreshToken) {
      const request: IRefreshTokenRequest = { refreshToken };
      this.http.post<void>(`${this.apiUrl}/logout`, request).subscribe({ error: () => {} });
    }
  }

  /** Lee y limpia el motivo del último logout forzado (para mostrarlo una sola vez en login). */
  consumeLogoutReason(): string | null {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (reason) {
      sessionStorage.removeItem(LOGOUT_REASON_KEY);
    }
    return reason;
  }

  private applySession(response: ILoginResponse): void {
    this._token.set(response.token);
    this._currentUser.set(response.user);
    this._refreshToken = response.refreshToken;
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
    sessionStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    sessionStorage.setItem(EXPIRES_AT_KEY, response.expiresAt);
    this.scheduleRefresh(response.expiresAt);
  }

  private clearSession(): void {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    this._token.set(null);
    this._currentUser.set(null);
    this._refreshToken = null;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_AT_KEY);
  }

  private scheduleRefresh(expiresAt: string): void {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
    }

    const delay = new Date(expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS;
    this.refreshTimerId = setTimeout(() => {
      this.refresh().subscribe({ error: () => {} });
    }, Math.max(delay, 0));
  }

  private loadToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): IUser | null {
    const data = sessionStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
