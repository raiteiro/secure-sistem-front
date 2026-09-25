import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IConsignmentBalance,
  IConsignmentSale,
  IConsignmentSaleFilters,
  IConsignmentSettlement,
  IConsignmentSettlementDetail,
  IConsignmentSettlementFilters,
  ICreateSettlementRequest
} from '../../../core/models/consignment.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class ConsignmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/consignment`;

  /** Cuánto se le debe a cada consignador ahora mismo. Sin paginar — una fila por consignador activo */
  getBalances(): Observable<IConsignmentBalance[]> {
    return this.http.get<IConsignmentBalance[]>(`${this.apiUrl}/balances`);
  }

  /** Bitácora de ventas de artículos consignados. Paginado — ver `IPagedResult` */
  getSales(filters?: IConsignmentSaleFilters): Observable<IPagedResult<IConsignmentSale>> {
    let params = new HttpParams();
    if (filters?.supplierId) params = params.set('supplierId', filters.supplierId);
    if (filters?.pending !== undefined) params = params.set('pending', String(filters.pending));
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IConsignmentSale>>(`${this.apiUrl}/sales`, { params });
  }

  /** El caller debe manejar el 400 (nada pendiente para ese proveedor) */
  createSettlement(request: ICreateSettlementRequest): Observable<IConsignmentSettlementDetail> {
    return this.http.post<IConsignmentSettlementDetail>(`${this.apiUrl}/settlements`, request);
  }

  /** Paginado — ver `IPagedResult` */
  getSettlements(filters?: IConsignmentSettlementFilters): Observable<IPagedResult<IConsignmentSettlement>> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IConsignmentSettlement>>(`${this.apiUrl}/settlements`, { params });
  }

  getSettlementById(id: number): Observable<IConsignmentSettlementDetail> {
    return this.http.get<IConsignmentSettlementDetail>(`${this.apiUrl}/settlements/${id}`);
  }
}
