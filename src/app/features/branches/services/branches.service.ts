import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IBranch, IBranchRequest } from '../../../core/models/branch.models';

@Injectable({ providedIn: 'root' })
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Branches`;

  /** Solo activas de tu empresa, o de todas si eres admin de sistema */
  getAll(): Observable<IBranch[]> {
    return this.http.get<IBranch[]>(this.apiUrl);
  }

  getById(id: number): Observable<IBranch> {
    return this.http.get<IBranch>(`${this.apiUrl}/${id}`);
  }

  create(request: IBranchRequest): Observable<IBranch> {
    return this.http.post<IBranch>(this.apiUrl, request);
  }

  update(id: number, request: IBranchRequest): Observable<IBranch> {
    return this.http.post<IBranch>(`${this.apiUrl}/${id}/update`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
