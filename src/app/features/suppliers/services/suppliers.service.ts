import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ISupplier, ISupplierRequest } from '../../../core/models/supplier.models';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/suppliers`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<ISupplier[]> {
    return this.http.get<ISupplier[]>(this.apiUrl);
  }

  getById(id: number): Observable<ISupplier> {
    return this.http.get<ISupplier>(`${this.apiUrl}/${id}`);
  }

  create(request: ISupplierRequest): Observable<ISupplier> {
    return this.http.post<ISupplier>(this.apiUrl, request);
  }

  update(id: number, request: ISupplierRequest): Observable<ISupplier> {
    return this.http.post<ISupplier>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
