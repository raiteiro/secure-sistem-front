import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ICashierCloseout,
  ICashierCloseoutFilters,
  ISalesByPeriodFilters,
  ISalesByPeriodReport,
  ISalesByTicketFilters,
  ISalesByTicketReport,
  ISalesDetailFilters,
  ISalesDetailReport,
  ITopProduct,
  ITopProductsFilters
} from '../../../core/models/report.models';
import { IPageFilters, IPagedResult } from '../../../core/models/pagination.models';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../core/utils/fetch-all-pages.util';

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

  /** "Ventas por producto". Todos los filtros son opcionales */
  getTopProducts(filters?: ITopProductsFilters): Observable<ITopProduct[]> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get<ITopProduct[]>(`${this.apiUrl}/top-products`, { params });
  }

  /** "Ventas por ticket". Todos los filtros son opcionales. Sin from/to → mes en curso a la fecha */
  getSalesByTicket(filters?: ISalesByTicketFilters): Observable<ISalesByTicketReport> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get<ISalesByTicketReport>(`${this.apiUrl}/sales-by-ticket`, { params });
  }

  /** Todos los filtros son opcionales. from/to filtran por closedAt (solo turnos ya cerrados) */
  getCashierCloseoutsPage(filters?: ICashierCloseoutFilters & IPageFilters): Observable<IPagedResult<ICashierCloseout>> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.userId) params = params.set('userId', filters.userId);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<ICashierCloseout>>(`${this.apiUrl}/cashier-closeouts`, { params });
  }

  /** Igual que `getCashierCloseoutsPage`, pero recorre todas las páginas */
  getCashierCloseouts(filters?: ICashierCloseoutFilters): Observable<ICashierCloseout[]> {
    return fetchAllPages((page) => this.getCashierCloseoutsPage({ ...filters, page, pageSize: MAX_PAGE_SIZE }));
  }

  /** Todos los filtros son opcionales. Sin from/to → mes en curso a la fecha */
  getSalesDetail(filters?: ISalesDetailFilters): Observable<ISalesDetailReport> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get<ISalesDetailReport>(`${this.apiUrl}/sales-detail`, { params });
  }

  /** PDF con el mismo look para los 4 reportes, generado en el backend (QuestPDF) — ver CLAUDE.md "Reportes". */
  getSalesByPeriodPdf(filters?: ISalesByPeriodFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.groupBy) params = params.set('groupBy', filters.groupBy);
    return this.http.get(`${this.apiUrl}/sales-by-period/pdf`, { params, responseType: 'blob' });
  }

  getTopProductsPdf(filters?: ITopProductsFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get(`${this.apiUrl}/top-products/pdf`, { params, responseType: 'blob' });
  }

  getSalesByTicketPdf(filters?: ISalesByTicketFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get(`${this.apiUrl}/sales-by-ticket/pdf`, { params, responseType: 'blob' });
  }

  getCashierCloseoutsPdf(filters?: ICashierCloseoutFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.userId) params = params.set('userId', filters.userId);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get(`${this.apiUrl}/cashier-closeouts/pdf`, { params, responseType: 'blob' });
  }

  getSalesDetailPdf(filters?: ISalesDetailFilters): Observable<Blob> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get(`${this.apiUrl}/sales-detail/pdf`, { params, responseType: 'blob' });
  }
}
