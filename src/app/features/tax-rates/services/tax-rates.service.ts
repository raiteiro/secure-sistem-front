import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ITaxRate, ITaxRateRequest } from '../../../core/models/tax-rate.models';

@Injectable({ providedIn: 'root' })
export class TaxRatesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/TaxRates`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<ITaxRate[]> {
    return this.http.get<ITaxRate[]>(this.apiUrl);
  }

  getById(id: number): Observable<ITaxRate> {
    return this.http.get<ITaxRate>(`${this.apiUrl}/${id}`);
  }

  create(request: ITaxRateRequest): Observable<ITaxRate> {
    return this.http.post<ITaxRate>(this.apiUrl, request);
  }

  update(id: number, request: ITaxRateRequest): Observable<ITaxRate> {
    return this.http.post<ITaxRate>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
