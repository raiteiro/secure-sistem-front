import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IPermission } from '../models/permission.models';
import { AuthService } from './auth.service';

/**
 * Resuelve si el usuario logueado puede ejecutar una acción de negocio (botón) de una ventana.
 * Ver PERMISSIONS.md para el catálogo completo de ids (ej. "USERS.CREATE").
 *
 * En cuanto hay sesión, pide una sola vez GET /api/Permissions/my-permissions (los Key que tiene
 * el usuario) y los cachea hasta que cambie el usuario logueado o se cierre sesión. Mientras esa
 * llamada no ha resuelto (justo después del login) `has()` no oculta nada, para no parpadear
 * botones que sí va a tener — el enforcement real del backend en cada endpoint no depende de esto.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/Permissions`;

  private readonly grantedKeys = signal<Set<string> | null>(null);
  private loadedForUserId: number | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();

      if (!user) {
        this.loadedForUserId = null;
        this.grantedKeys.set(null);
        return;
      }

      if (user.id === this.loadedForUserId) return;
      this.loadedForUserId = user.id;

      this.http.get<string[]>(`${this.apiUrl}/my-permissions`).subscribe({
        next: (keys) => this.grantedKeys.set(new Set(keys)),
        error: () => this.grantedKeys.set(new Set())
      });
    });
  }

  has(permissionId: string): boolean {
    if (this.authService.isSystemAdmin()) return true;

    const granted = this.grantedKeys();
    if (granted === null) return true;

    return granted.has(permissionId);
  }

  /** Catálogo global de permisos, para el selector de "Asignar permisos" de un rol */
  getCatalog(): Observable<IPermission[]> {
    return this.http.get<IPermission[]>(this.apiUrl);
  }
}
