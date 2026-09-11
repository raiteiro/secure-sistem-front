import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICompany, ICompanyRequest, ICompanyLogoResponse } from '../../../core/models/company.models';

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Companies`;
  /** apiUrl menos el sufijo /api: logoPath es una ruta servida como estático desde la raíz del backend, no bajo /api */
  private readonly filesBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  getAll(): Observable<ICompany[]> {
    return this.http.get<ICompany[]>(this.apiUrl);
  }

  getById(id: number): Observable<ICompany> {
    return this.http.get<ICompany>(`${this.apiUrl}/${id}`);
  }

  create(request: ICompanyRequest): Observable<ICompany> {
    return this.http.post<ICompany>(this.apiUrl, request);
  }

  update(id: number, request: ICompanyRequest): Observable<ICompany> {
    return this.http.post<ICompany>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  uploadLogo(id: number, file: File): Observable<ICompanyLogoResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ICompanyLogoResponse>(`${this.apiUrl}/${id}/logo`, formData);
  }

  /** Arma la URL completa para usar como `src` de una imagen a partir de `ICompany.logoPath` */
  getLogoUrl(logoPath: string | null): string | null {
    return logoPath ? `${this.filesBaseUrl}${logoPath}` : null;
  }
}
