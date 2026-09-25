import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICategory, ICategoryRequest } from '../../../core/models/category.models';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Categories`;

  /** Solo activas de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<ICategory[]> {
    return this.http.get<ICategory[]>(this.apiUrl);
  }

  getById(id: number): Observable<ICategory> {
    return this.http.get<ICategory>(`${this.apiUrl}/${id}`);
  }

  create(request: ICategoryRequest): Observable<ICategory> {
    return this.http.post<ICategory>(this.apiUrl, request);
  }

  update(id: number, request: ICategoryRequest): Observable<ICategory> {
    return this.http.post<ICategory>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
