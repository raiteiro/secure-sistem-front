import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICashRegister, ICashRegisterRequest } from '../../../core/models/cash-register.models';

@Injectable({ providedIn: 'root' })
export class CashRegistersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/CashRegisters`;

  /** Solo activas de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<ICashRegister[]> {
    return this.http.get<ICashRegister[]>(this.apiUrl);
  }

  getById(id: number): Observable<ICashRegister> {
    return this.http.get<ICashRegister>(`${this.apiUrl}/${id}`);
  }

  create(request: ICashRegisterRequest): Observable<ICashRegister> {
    return this.http.post<ICashRegister>(this.apiUrl, request);
  }

  update(id: number, request: ICashRegisterRequest): Observable<ICashRegister> {
    return this.http.post<ICashRegister>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
