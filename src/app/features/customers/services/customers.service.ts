import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICustomer, ICustomerRequest } from '../../../core/models/customer.models';
import { IPageFilters, IPagedResult } from '../../../core/models/pagination.models';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../core/utils/fetch-all-pages.util';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Customers`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema. Una página — ver `IPagedResult` */
  getPage(filters?: IPageFilters): Observable<IPagedResult<ICustomer>> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<ICustomer>>(this.apiUrl, { params });
  }

  /** Igual que `getPage`, pero recorre todas las páginas y devuelve la lista completa */
  getAll(): Observable<ICustomer[]> {
    return fetchAllPages((page) => this.getPage({ page, pageSize: MAX_PAGE_SIZE }));
  }

  getById(id: number): Observable<ICustomer> {
    return this.http.get<ICustomer>(`${this.apiUrl}/${id}`);
  }

  create(request: ICustomerRequest): Observable<ICustomer> {
    return this.http.post<ICustomer>(this.apiUrl, request);
  }

  update(id: number, request: ICustomerRequest): Observable<ICustomer> {
    return this.http.post<ICustomer>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
