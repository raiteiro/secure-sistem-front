import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ICancelSaleRequest,
  ISale,
  ISaleFilters,
  ISaleReceipt,
  ISaleRequest,
  ISendReceiptResponse
} from '../../../core/models/sale.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Sales`;

  /** Más reciente primero. Todos los filtros son opcionales. Paginado — ver `IPagedResult` */
  getAll(filters?: ISaleFilters): Observable<IPagedResult<ISale>> {
    let params = new HttpParams();
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.cashSessionId) params = params.set('cashSessionId', filters.cashSessionId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<ISale>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ISale> {
    return this.http.get<ISale>(`${this.apiUrl}/${id}`);
  }

  create(request: ISaleRequest): Observable<ISale> {
    return this.http.post<ISale>(this.apiUrl, request);
  }

  /** Datos para armar/imprimir el ticket — incluye el encabezado de empresa que getById no trae */
  getReceipt(id: number): Observable<ISaleReceipt> {
    return this.http.get<ISaleReceipt>(`${this.apiUrl}/${id}/receipt`);
  }

  /** Si se omite `email`, el backend usa el del cliente de la venta. El caller debe manejar 400/502 */
  sendReceipt(id: number, email?: string): Observable<ISendReceiptResponse> {
    return this.http.post<ISendReceiptResponse>(`${this.apiUrl}/${id}/send-receipt`, { email });
  }

  /**
   * Anula la venta completa. Solo aplica si el turno sigue abierto y no tiene devoluciones aplicadas.
   * `request` es opcional: sin SALES.CANCEL, el backend responde 403 con `requiresSupervisorApproval`
   * y hay que reintentar mandando las credenciales de un supervisor que sí tenga el permiso.
   */
  cancel(id: number, request?: ICancelSaleRequest): Observable<ISale> {
    return this.http.post<ISale>(`${this.apiUrl}/${id}/cancel`, request ?? {});
  }
}
