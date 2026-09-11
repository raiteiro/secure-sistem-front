import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { INavigationRoute } from '../models/navigation.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/NavigationRoutes`;

  private _routes = signal<INavigationRoute[]>([]);
  readonly routes = this._routes.asReadonly();

  /** Carga el árbol de navegación del usuario. Intenta /my-tree, fallback a /user-tree con params */
  loadUserTree(): Observable<INavigationRoute[]> {
    return this.http.get<INavigationRoute[]>(`${this.apiUrl}/my-tree`).pipe(
      tap((routes) => this._routes.set(routes)),
      catchError(() => {
        // Fallback al endpoint anterior con query params
        const user = this.authService.currentUser();
        if (!user) return of([]);
        const params = { userId: user.id.toString(), roleId: '1', companyId: (user.companyId ?? 1).toString() };
        return this.http.get<INavigationRoute[]>(`${this.apiUrl}/user-tree`, { params }).pipe(
          tap((routes) => this._routes.set(routes)),
          catchError(() => of([]))
        );
      })
    );
  }

  clear(): void {
    this._routes.set([]);
  }
}
