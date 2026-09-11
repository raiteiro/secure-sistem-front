import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Bloquea toda navegación dentro del layout autenticado mientras el usuario deba cambiar su contraseña */
export const mustChangePasswordGuard: CanActivateChildFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.mustChangePassword()) {
    router.navigate(['/change-password']);
    return false;
  }

  return true;
};
