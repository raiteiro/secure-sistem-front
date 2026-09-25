import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IInventoryMovement,
  IInventoryMovementFilters,
  IInventoryMovementRequest
} from '../../../core/models/inventory.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class InventoryMovementsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/InventoryMovements`;

  /** Historial, más reciente primero. Bitácora inmutable: no hay editar/borrar. Paginado — ver `IPagedResult` */
  getAll(filters?: IInventoryMovementFilters): Observable<IPagedResult<IInventoryMovement>> {
    let params = new HttpParams();
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IInventoryMovement>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<IInventoryMovement> {
    return this.http.get<IInventoryMovement>(`${this.apiUrl}/${id}`);
  }

  create(request: IInventoryMovementRequest): Observable<IInventoryMovement> {
    return this.http.post<IInventoryMovement>(this.apiUrl, request);
  }
}
