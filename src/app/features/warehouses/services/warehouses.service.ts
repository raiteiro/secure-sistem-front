import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IWarehouse, IWarehouseRequest } from '../../../core/models/warehouse.models';

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Warehouses`;

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<IWarehouse[]> {
    return this.http.get<IWarehouse[]>(this.apiUrl);
  }

  getById(id: number): Observable<IWarehouse> {
    return this.http.get<IWarehouse>(`${this.apiUrl}/${id}`);
  }

  create(request: IWarehouseRequest): Observable<IWarehouse> {
    return this.http.post<IWarehouse>(this.apiUrl, request);
  }

  update(id: number, request: IWarehouseRequest): Observable<IWarehouse> {
    return this.http.post<IWarehouse>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
