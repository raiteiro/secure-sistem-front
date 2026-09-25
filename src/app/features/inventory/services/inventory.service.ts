import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IInventoryFilters, IInventoryItem, IMinStockRequest } from '../../../core/models/inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Inventory`;

  /** Stock actual (solo lectura). Solo de tu empresa, o de todas si eres admin de sistema */
  getAll(filters?: IInventoryFilters): Observable<IInventoryItem[]> {
    let params = new HttpParams();
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.lowStockOnly) params = params.set('lowStockOnly', 'true');
    return this.http.get<IInventoryItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<IInventoryItem> {
    return this.http.get<IInventoryItem>(`${this.apiUrl}/${id}`);
  }

  setMinStock(id: number, request: IMinStockRequest): Observable<IInventoryItem> {
    return this.http.post<IInventoryItem>(`${this.apiUrl}/${id}/min-stock`, request);
  }
}
