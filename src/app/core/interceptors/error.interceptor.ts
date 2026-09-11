import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isAuthEndpoint =
    req.url.includes('/Auth/login') ||
    req.url.includes('/Auth/refresh') ||
    req.url.includes('/Auth/logout') ||
    req.url.includes('/Auth/forgot-password') ||
    req.url.includes('/Auth/reset-password');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // El token expiró a mitad de sesión: intentar un refresh y reintentar la petición una sola vez.
      if (error.status === 401 && !isAuthEndpoint) {
        return authService.refresh().pipe(
          switchMap((session) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } }))
          ),
          catchError(() => throwError(() => error))
        );
      }
      // Los endpoints públicos de auth manejan su propio error (login: muestra mensaje; refresh: dispara logout;
      // logout/forgot-password/reset-password: los maneja el propio componente o se ignoran)
      return throwError(() => error);
    })
  );
};
