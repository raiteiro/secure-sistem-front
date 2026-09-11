import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private token = '';
  invalidLink = signal(false);
  success = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  form = { newPassword: '', confirmPassword: '' };

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.invalidLink.set(true);
      return;
    }
    this.token = token;
  }

  onSubmit(): void {
    if (!this.form.newPassword || !this.form.confirmPassword) {
      this.errorMessage.set('Completa ambos campos');
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

    this.authService.resetPassword({ token: this.token, newPassword: this.form.newPassword }).subscribe({
      next: () => { this.isLoading.set(false); this.success.set(true); },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message ?? 'El enlace no es válido, expiró o ya fue usado.'
        );
      }
    });
  }
}
