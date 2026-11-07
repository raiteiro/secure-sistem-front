import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IProductExtra, IProductExtraRequest } from '../../../core/models/product-extra.models';

@Injectable({ providedIn: 'root' })
export class ProductExtrasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ProductExtras`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<IProductExtra[]> {
    return this.http.get<IProductExtra[]>(this.apiUrl);
  }

  getById(id: number): Observable<IProductExtra> {
    return this.http.get<IProductExtra>(`${this.apiUrl}/${id}`);
  }

  create(request: IProductExtraRequest): Observable<IProductExtra> {
    return this.http.post<IProductExtra>(this.apiUrl, request);
  }

  update(id: number, request: IProductExtraRequest): Observable<IProductExtra> {
    return this.http.post<IProductExtra>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
