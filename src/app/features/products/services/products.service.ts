import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IAssignComboItemsRequest,
  IAssignRecipeRequest,
  IComboItem,
  IManufacturedProductRequest,
  IProduct,
  IProductImageResponse,
  IProductRequest,
  IRecipeItem
} from '../../../core/models/product.models';
import { IPageFilters, IPagedResult } from '../../../core/models/pagination.models';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../core/utils/fetch-all-pages.util';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Products`;
  /** apiUrl menos el sufijo /api: imagePath es una ruta servida como estático desde la raíz del backend */
  private readonly filesBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  /** Solo activos de tu empresa, o de todas si eres admin de sistema. Una página — ver `IPagedResult` */
  getPage(filters?: IPageFilters): Observable<IPagedResult<IProduct>> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<IPagedResult<IProduct>>(this.apiUrl, { params });
  }

  /** Igual que `getPage`, pero recorre todas las páginas y devuelve el catálogo completo */
  getAll(): Observable<IProduct[]> {
    return fetchAllPages((page) => this.getPage({ page, pageSize: MAX_PAGE_SIZE }));
  }

  getById(id: number): Observable<IProduct> {
    return this.http.get<IProduct>(`${this.apiUrl}/${id}`);
  }

  create(request: IProductRequest): Observable<IProduct> {
    return this.http.post<IProduct>(this.apiUrl, request);
  }

  update(id: number, request: IProductRequest): Observable<IProduct> {
    return this.http.post<IProduct>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  uploadImage(id: number, file: File): Observable<IProductImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<IProductImageResponse>(`${this.apiUrl}/${id}/image`, formData);
  }

  /** Arma la URL completa para usar como `src` de una imagen a partir de `IProduct.imagePath` */
  getImageUrl(imagePath: string | null): string | null {
    return imagePath ? `${this.filesBaseUrl}${imagePath}` : null;
  }

  /** Componentes de un producto combo/kit */
  getComboItems(id: number): Observable<IComboItem[]> {
    return this.http.get<IComboItem[]>(`${this.apiUrl}/${id}/combo-items`);
  }

  /** Reemplazo completo de los componentes del combo. El producto debe tener isCombo=true */
  assignComboItems(id: number, request: IAssignComboItemsRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/combo-items`, request);
  }

  /** Alta de un producto fabricado junto con su receta (una transacción) */
  createManufactured(request: IManufacturedProductRequest): Observable<IProduct> {
    return this.http.post<IProduct>(`${this.apiUrl}/manufactured`, request);
  }

  /** Receta (insumos por 1 unidad) de un producto fabricado */
  getRecipe(id: number): Observable<IRecipeItem[]> {
    return this.http.get<IRecipeItem[]>(`${this.apiUrl}/${id}/recipe`);
  }

  /** Reemplazo completo de la receta. El producto debe tener isManufactured=true */
  assignRecipe(id: number, request: IAssignRecipeRequest): Observable<IRecipeItem[]> {
    return this.http.post<IRecipeItem[]>(`${this.apiUrl}/${id}/recipe`, request);
  }
}
