import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <h1>Dashboard</h1>
    <p>Bienvenido, {{ authService.currentUser()?.firstName }} {{ authService.currentUser()?.lastName }}</p>
  `
})
export class DashboardComponent {
  readonly authService = inject(AuthService);
}
