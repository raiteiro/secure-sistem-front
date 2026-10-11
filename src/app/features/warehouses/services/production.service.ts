import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IProductionAvailability,
  IProductionAvailabilityFilters,
  IProductionFilters,
  IProductionOrder,
  IProductionRequest
} from '../../../core/models/production.models';
import { IPagedResult } from '../../../core/models/pagination.models';

/** Fabricar productos con insumos en un almacén y separarlos de vuelta en insumos */
@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Production`;

  /** Cuánto se puede fabricar de cada producto fabricado por almacén. No paginado, solo informativo */
  getAvailability(filters?: IProductionAvailabilityFilters): Observable<IProductionAvailability[]> {
    let params = new HttpParams();
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.productId) params = params.set('productId', filters.productId);
    return this.http.get<IProductionAvailability[]>(`${this.apiUrl}/availability`, { params });
  }

  /** Historial de órdenes (fabricar y separar), más reciente primero. Paginado — ver `IPagedResult` */
  getOrders(filters?: IProductionFilters): Observable<IPagedResult<IProductionOrder>> {
    let params = new HttpParams();
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IProductionOrder>>(this.apiUrl, { params });
  }

  getOrder(id: number): Observable<IProductionOrder> {
    return this.http.get<IProductionOrder>(`${this.apiUrl}/${id}`);
  }

  /** Fabricar: descuenta los insumos de la receta y suma el producto. 400 con `maxProducible` si no alcanza */
  produce(request: IProductionRequest): Observable<IProductionOrder> {
    return this.http.post<IProductionOrder>(this.apiUrl, request);
  }

  /** Separar: descuenta el producto y regresa los insumos de la receta actual. 400 con `currentStock` si no alcanza */
  disassemble(request: IProductionRequest): Observable<IProductionOrder> {
    return this.http.post<IProductionOrder>(`${this.apiUrl}/disassemble`, request);
  }
}
