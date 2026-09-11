import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { ILoginRequest } from '../../../core/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  credentials: ILoginRequest = { username: '', password: '' };
  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  ngOnInit(): void {
    // Mensaje de una sesión cerrada por el backend (suscripción vencida, empresa desactivada, refresh inválido)
    const reason = this.authService.consumeLogoutReason();
    if (reason) {
      this.errorMessage.set(reason);
    }
  }

  onLogin(): void {
    if (!this.credentials.username || !this.credentials.password) {
      this.errorMessage.set('Usuario y contraseña son obligatorios');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.credentials).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message ?? 'Credenciales inválidas o error de conexión'
        );
      }
    });
  }
}
