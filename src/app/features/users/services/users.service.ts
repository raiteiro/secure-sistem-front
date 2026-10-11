import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IUser,
  ICreateUserRequest,
  IUpdateUserRequest,
  IReassignCompanyRequest,
  IResetUserPasswordResponse
} from '../../../core/models/user.models';
import { IPageFilters, IPagedResult } from '../../../core/models/pagination.models';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../core/utils/fetch-all-pages.util';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Users`;

  /** Usuarios activos, una página — ver `IPagedResult` (el backend usa 25 por defecto, máximo 100) */
  getPage(filters?: IPageFilters): Observable<IPagedResult<IUser>> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IUser>>(this.apiUrl, { params });
  }

  /** Todos los usuarios activos, recorriendo todas las páginas */
  getAll(): Observable<IUser[]> {
    return fetchAllPages((page) => this.getPage({ page, pageSize: MAX_PAGE_SIZE }));
  }

  getById(id: number): Observable<IUser> {
    return this.http.get<IUser>(`${this.apiUrl}/${id}`);
  }

  create(user: ICreateUserRequest): Observable<IUser> {
    return this.http.post<IUser>(this.apiUrl, user);
  }

  update(id: number, user: IUpdateUserRequest): Observable<IUser> {
    return this.http.post<IUser>(`${this.apiUrl}/${id}/update`, user);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  reassignCompany(id: number, request: IReassignCompanyRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/reassign-company`, request);
  }

  resetPassword(id: number): Observable<IResetUserPasswordResponse> {
    return this.http.post<IResetUserPasswordResponse>(`${this.apiUrl}/${id}/reset-password`, {});
  }
}
