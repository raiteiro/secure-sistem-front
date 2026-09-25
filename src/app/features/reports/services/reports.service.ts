import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ICashierCloseout,
  ICashierCloseoutFilters,
  ISalesByPeriodFilters,
  ISalesByPeriodReport,
  ITopProduct,
  ITopProductsFilters
} from '../../../core/models/report.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  /** Todos los filtros son opcionales. Sin from/to → mes en curso a la fecha */
  getSalesByPeriod(filters?: ISalesByPeriodFilters): Observable<ISalesByPeriodReport> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.groupBy) params = params.set('groupBy', filters.groupBy);
    return this.http.get<ISalesByPeriodReport>(`${this.apiUrl}/sales-by-period`, { params });
  }

  /** Todos los filtros son opcionales */
  getTopProducts(filters?: ITopProductsFilters): Observable<ITopProduct[]> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<ITopProduct[]>(`${this.apiUrl}/top-products`, { params });
  }

  /** Todos los filtros son opcionales. from/to filtran por closedAt (solo turnos ya cerrados) */
  getCashierCloseouts(filters?: ICashierCloseoutFilters): Observable<ICashierCloseout[]> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.userId) params = params.set('userId', filters.userId);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get<ICashierCloseout[]>(`${this.apiUrl}/cashier-closeouts`, { params });
  }
}
