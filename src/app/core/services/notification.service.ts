import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Servicio centralizado de notificaciones.
 * MessageService se provee a nivel root en app.config.ts.
 * El toast global está en MainLayoutComponent con key="global".
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);

  success(detail: string, summary = 'Éxito'): void {
    this.messageService.add({ severity: 'success', summary, detail, life: 3000, key: 'global' });
  }

  error(detail: string, summary = 'Error'): void {
    this.messageService.add({ severity: 'error', summary, detail, life: 5000, key: 'global' });
  }

  warn(detail: string, summary = 'Atención'): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 4000, key: 'global' });
  }

  info(detail: string, summary = 'Info'): void {
    this.messageService.add({ severity: 'info', summary, detail, life: 3000, key: 'global' });
  }

  /**
   * Muestra el mensaje de un error HTTP. Entiende los dos formatos del backend: `{ message }` y el de
   * validación de modelo de ASP.NET (`{ errors: { campo: [mensaje, ...] } }`), del que toma el primero.
   */
  httpError(err: unknown, fallback = 'Ocurrió un error'): void {
    const body = (err as { error?: { message?: string; errors?: Record<string, string[]> } })?.error;
    const validationMessage = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    this.error(body?.message ?? validationMessage ?? fallback);
  }
}
