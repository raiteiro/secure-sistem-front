import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IAssignComboItemsRequest,
  IComboItem,
  IProduct,
  IProductImageResponse,
  IProductRequest
} from '../../../core/models/product.models';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Products`;
  /** apiUrl menos el sufijo /api: imagePath es una ruta servida como estático desde la raíz del backend */
  private readonly filesBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  /** Solo activos de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<IProduct[]> {
    return this.http.get<IProduct[]>(this.apiUrl);
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
}
