import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IReturn, IReturnFilters, IReturnRequest } from '../../../core/models/return.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Returns`;

  /** Más reciente primero. Todos los filtros son opcionales. Paginado — ver `IPagedResult` */
  getAll(filters?: IReturnFilters): Observable<IPagedResult<IReturn>> {
    let params = new HttpParams();
    if (filters?.saleId) params = params.set('saleId', filters.saleId);
    if (filters?.cashSessionId) params = params.set('cashSessionId', filters.cashSessionId);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IReturn>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<IReturn> {
    return this.http.get<IReturn>(`${this.apiUrl}/${id}`);
  }

  /** El caller debe manejar el 400 (cantidad excede el remanente pendiente por línea) */
  create(request: IReturnRequest): Observable<IReturn> {
    return this.http.post<IReturn>(this.apiUrl, request);
  }
}
