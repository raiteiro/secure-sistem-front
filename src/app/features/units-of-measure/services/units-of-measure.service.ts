import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IUnitOfMeasure, IUnitOfMeasureRequest } from '../../../core/models/unit-of-measure.models';

/** Catálogo global de unidades de medida. Leerlo: cualquier usuario; modificarlo: solo admin de sistema */
@Injectable({ providedIn: 'root' })
export class UnitsOfMeasureService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/UnitsOfMeasure`;

  /** Solo activas, salvo `includeInactive` (pantalla del catálogo). No paginado: es un catálogo corto */
  getAll(includeInactive = false): Observable<IUnitOfMeasure[]> {
    const params = includeInactive ? new HttpParams().set('includeInactive', 'true') : undefined;
    return this.http.get<IUnitOfMeasure[]>(this.apiUrl, { params });
  }

  create(request: IUnitOfMeasureRequest): Observable<IUnitOfMeasure> {
    return this.http.post<IUnitOfMeasure>(this.apiUrl, request);
  }

  update(id: number, request: IUnitOfMeasureRequest): Observable<IUnitOfMeasure> {
    return this.http.post<IUnitOfMeasure>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  activate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/activate`, {});
  }
}
