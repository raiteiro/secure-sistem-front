import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly forced = this.authService.mustChangePassword;

  form = { currentPassword: '', newPassword: '', confirmPassword: '' };
  isLoading = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    // Si ya no le toca cambiarla (llegó aquí por URL directa), no hay nada que forzar
    if (!this.authService.mustChangePassword()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onLogout(): void {
    this.authService.logout();
  }

  onSubmit(): void {
    if (!this.form.currentPassword || !this.form.newPassword || !this.form.confirmPassword) {
      this.errorMessage.set('Completa todos los campos');
      return;
    }
    if (this.form.newPassword.length < 8) {
      this.errorMessage.set('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.form.newPassword !== this.form.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.changePassword({
      currentPassword: this.form.currentPassword,
      newPassword: this.form.newPassword
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.notify.success('Contraseña actualizada');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'No se pudo actualizar la contraseña');
      }
    });
  }
}
