import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ICashSession,
  ICashSessionFilters,
  ICloseCashSessionRequest,
  IOpenCashSessionRequest
} from '../../../core/models/cash-session.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class CashSessionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CashSessions`;

  /** Historial, más reciente primero. Paginado — ver `IPagedResult` */
  getAll(filters?: ICashSessionFilters): Observable<IPagedResult<ICashSession>> {
    let params = new HttpParams();
    if (filters?.cashRegisterId) params = params.set('cashRegisterId', filters.cashRegisterId);
    if (filters?.isOpen !== undefined) params = params.set('isOpen', String(filters.isOpen));
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<ICashSession>>(this.apiUrl, { params });
  }

  /** El turno abierto del usuario logueado. El caller debe manejar el 404 (sin turno abierto) */
  getCurrent(): Observable<ICashSession> {
    return this.http.get<ICashSession>(`${this.apiUrl}/current`);
  }

  getById(id: number): Observable<ICashSession> {
    return this.http.get<ICashSession>(`${this.apiUrl}/${id}`);
  }

  open(request: IOpenCashSessionRequest): Observable<ICashSession> {
    return this.http.post<ICashSession>(`${this.apiUrl}/open`, request);
  }

  close(id: number, request: ICloseCashSessionRequest): Observable<ICashSession> {
    return this.http.post<ICashSession>(`${this.apiUrl}/${id}/close`, request);
  }
}
