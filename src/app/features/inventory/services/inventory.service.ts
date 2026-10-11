import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IComboAvailability,
  IComboAvailabilityFilters,
  IInventoryFilters,
  IInventoryItem,
  IMinStockRequest
} from '../../../core/models/inventory.models';
import { IPageFilters, IPagedResult } from '../../../core/models/pagination.models';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../core/utils/fetch-all-pages.util';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Inventory`;

  /** Stock actual (solo lectura). Solo de tu empresa, o de todas si eres admin de sistema */
  getPage(filters?: IInventoryFilters & IPageFilters): Observable<IPagedResult<IInventoryItem>> {
    let params = new HttpParams();
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.lowStockOnly) params = params.set('lowStockOnly', 'true');
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IInventoryItem>>(this.apiUrl, { params });
  }

  /** Igual que `getPage`, pero recorre todas las páginas y devuelve el stock completo */
  getAll(filters?: IInventoryFilters): Observable<IInventoryItem[]> {
    return fetchAllPages((page) => this.getPage({ ...filters, page, pageSize: MAX_PAGE_SIZE }));
  }

  /** Combos que se pueden vender por almacén, calculados con el stock de sus componentes. No paginado */
  getComboAvailability(filters?: IComboAvailabilityFilters): Observable<IComboAvailability[]> {
    let params = new HttpParams();
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.productId) params = params.set('productId', filters.productId);
    return this.http.get<IComboAvailability[]>(`${this.apiUrl}/combo-availability`, { params });
  }

  getById(id: number): Observable<IInventoryItem> {
    return this.http.get<IInventoryItem>(`${this.apiUrl}/${id}`);
  }

  setMinStock(id: number, request: IMinStockRequest): Observable<IInventoryItem> {
    return this.http.post<IInventoryItem>(`${this.apiUrl}/${id}/min-stock`, request);
  }
}
