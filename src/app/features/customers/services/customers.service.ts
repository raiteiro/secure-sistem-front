import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICustomer, ICustomerRequest } from '../../../core/models/customer.models';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Customers`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<ICustomer[]> {
    return this.http.get<ICustomer[]>(this.apiUrl);
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
