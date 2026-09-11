import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  INavigationRoute,
  ICreateRouteRequest,
  IUpdateRouteRequest
} from '../../../core/models/navigation.models';

@Injectable({ providedIn: 'root' })
export class NavRoutesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/NavigationRoutes`;

  /** Lista plana */
  getAll(): Observable<INavigationRoute[]> {
    return this.http.get<INavigationRoute[]>(this.apiUrl);
  }

  /** Árbol completo de la empresa */
  getTree(): Observable<INavigationRoute[]> {
    return this.http.get<INavigationRoute[]>(`${this.apiUrl}/tree`);
  }

  getById(id: number): Observable<INavigationRoute> {
    return this.http.get<INavigationRoute>(`${this.apiUrl}/${id}`);
  }

  create(route: ICreateRouteRequest): Observable<INavigationRoute> {
    return this.http.post<INavigationRoute>(this.apiUrl, route);
  }

  update(id: number, route: IUpdateRouteRequest): Observable<INavigationRoute> {
    return this.http.post<INavigationRoute>(`${this.apiUrl}/${id}/update`, route);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
