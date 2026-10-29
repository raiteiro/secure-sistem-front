import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ICreateStockTransferRequest,
  IStockTransfer,
  IStockTransferFilters
} from '../../../core/models/stock-transfer.models';
import { IPagedResult } from '../../../core/models/pagination.models';

@Injectable({ providedIn: 'root' })
export class StockTransfersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/StockTransfers`;

  /** Historial, más reciente primero. `warehouseId` matchea origen o destino. Paginado — ver `IPagedResult` */
  getAll(filters?: IStockTransferFilters): Observable<IPagedResult<IStockTransfer>> {
    let params = new HttpParams();
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.productId) params = params.set('productId', filters.productId);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IStockTransfer>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<IStockTransfer> {
    return this.http.get<IStockTransfer>(`${this.apiUrl}/${id}`);
  }

  create(request: ICreateStockTransferRequest): Observable<IStockTransfer> {
    return this.http.post<IStockTransfer>(this.apiUrl, request);
  }
}
