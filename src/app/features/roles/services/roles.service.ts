import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IRole, ICreateRoleRequest, IUpdateRoleRequest, IAssignRoutesRequest } from '../../../core/models/role.models';
import { INavigationRoute } from '../../../core/models/navigation.models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Roles`;

  getAll(): Observable<IRole[]> {
    return this.http.get<IRole[]>(this.apiUrl);
  }

  getById(id: number): Observable<IRole> {
    return this.http.get<IRole>(`${this.apiUrl}/${id}`);
  }

  create(role: ICreateRoleRequest): Observable<IRole> {
    return this.http.post<IRole>(this.apiUrl, role);
  }

  update(id: number, role: IUpdateRoleRequest): Observable<IRole> {
    return this.http.post<IRole>(`${this.apiUrl}/${id}/update`, role);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  getRoutes(id: number): Observable<INavigationRoute[]> {
    return this.http.get<INavigationRoute[]>(`${this.apiUrl}/${id}/routes`);
  }

  assignRoutes(id: number, request: IAssignRoutesRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/routes`, request);
  }
}
