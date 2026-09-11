import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IUser,
  ICreateUserRequest,
  IUpdateUserRequest,
  IReassignCompanyRequest,
  IResetUserPasswordResponse
} from '../../../core/models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Users`;

  getAll(): Observable<IUser[]> {
    return this.http.get<IUser[]>(this.apiUrl);
  }

  getById(id: number): Observable<IUser> {
    return this.http.get<IUser>(`${this.apiUrl}/${id}`);
  }

  create(user: ICreateUserRequest): Observable<IUser> {
    return this.http.post<IUser>(this.apiUrl, user);
  }

  update(id: number, user: IUpdateUserRequest): Observable<IUser> {
    return this.http.post<IUser>(`${this.apiUrl}/${id}/update`, user);
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/deactivate`, {});
  }

  reassignCompany(id: number, request: IReassignCompanyRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/reassign-company`, request);
  }

  resetPassword(id: number): Observable<IResetUserPasswordResponse> {
    return this.http.post<IResetUserPasswordResponse>(`${this.apiUrl}/${id}/reset-password`, {});
  }
}
