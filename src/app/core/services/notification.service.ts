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

  httpError(err: unknown, fallback = 'Ocurrió un error'): void {
    const detail = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.error(detail);
  }
}
