import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);

  email = '';
  isLoading = signal(false);
  errorMessage = signal('');
  sent = signal(false);

  onSubmit(): void {
    if (!this.email) {
      this.errorMessage.set('Ingresa tu correo');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.forgotPassword({ email: this.email }).subscribe({
      // El backend siempre responde 200 exista o no el correo, así que un 200 aquí no confirma nada
      next: () => { this.isLoading.set(false); this.sent.set(true); },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('No se pudo procesar tu solicitud. Intenta de nuevo en unos minutos.');
      }
    });
  }
}
