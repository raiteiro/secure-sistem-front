import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CashSessionsService } from '../../../features/cash-sessions/services/cash-sessions.service';
import { CompaniesService } from '../../../features/companies/services/companies.service';
import { ICashSession, ICashSessionCloseout, ICloseCashSessionRequest, IReopenCashSessionRequest } from '../../../core/models/cash-session.models';
import { NotificationService } from '../../../core/services/notification.service';
import { PAYMENT_METHOD_LABELS } from '../../../core/constants/payment-methods';

/**
 * Modal de "Cerrar turno" (monto de cierre + notas) y el corte de caja imprimible que se
 * dispara automáticamente al cerrar — extraído de CashSessionListComponent para poder
 * cerrar el turno también desde el punto de venta (SalePosComponent), sin duplicar la lógica.
 * Standalone, sin dependencias de ninguna feature específica — solo necesita el turno actual.
 */
@Component({
  selector: 'app-close-cash-session-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './close-cash-session-dialog.component.html',
  styleUrl: './close-cash-session-dialog.component.scss'
})
export class CloseCashSessionDialogComponent {
  private readonly sessionsService = inject(CashSessionsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);

  /** El turno abierto que se va a cerrar — el padre decide cuándo mostrar el botón que llama a `open()` */
  @Input({ required: true }) session: ICashSession | null = null;

  /** Se emite cuando el cierre ya se guardó, con el turno cerrado — el padre recarga su propio estado */
  @Output() closed = new EventEmitter<ICashSession>();

  /** Se emite cuando un turno (cualquiera, no necesariamente `session`) ya se reabrió */
  @Output() reopened = new EventEmitter<ICashSession>();

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;

  // ===== Modal: cerrar turno =====
  showCloseModal = false;
  savingClose = false;
  closeForm: { closingAmount: number | null; notes: string } = { closingAmount: null, notes: '' };

  // ===== Modal: reabrir turno =====
  showReopenModal = false;
  savingReopen = false;
  reopenTarget: ICashSession | null = null;
  reopenForm: { reason: string } = { reason: '' };

  // ===== Modal: corte de caja (imprimible) =====
  showCloseoutModal = false;
  closeoutLoading = false;
  closeout: ICashSessionCloseout | null = null;

  /** Abre el formulario de cierre — llamar desde el botón "Cerrar turno" del componente que lo use */
  open(): void {
    if (!this.session) return;
    this.closeForm = { closingAmount: null, notes: '' };
    this.showCloseModal = true;
  }

  onSaveClose(): void {
    const session = this.session;
    if (!session) return;
    if (this.closeForm.closingAmount === null || this.closeForm.closingAmount < 0) {
      this.notify.warn('Ingresa un monto de cierre válido');
      return;
    }

    const request: ICloseCashSessionRequest = {
      closingAmount: this.closeForm.closingAmount,
      notes: this.closeForm.notes || null
    };

    this.savingClose = true;
    this.sessionsService.close(session.id, request).subscribe({
      next: (closed) => {
        this.savingClose = false;
        this.showCloseModal = false;
        const expected = closed.expectedAmount !== null ? closed.expectedAmount.toFixed(2) : '—';
        const difference = closed.difference !== null ? closed.difference.toFixed(2) : '—';
        this.notify.success(`Turno cerrado. Esperado: ${expected}, Diferencia: ${difference}`);
        this.closed.emit(closed);
        this.loadAndPrintCloseout(closed.id, true);
      },
      error: (e) => { this.savingClose = false; this.notify.httpError(e); }
    });
  }

  /** Reimprimir el corte de un turno ya cerrado (ej. desde un historial) */
  reprint(cashSessionId: number): void {
    this.loadAndPrintCloseout(cashSessionId, false);
  }

  /** Abre el formulario de reapertura para un turno cerrado del historial (requiere motivo) */
  openReopen(target: ICashSession): void {
    this.reopenTarget = target;
    this.reopenForm = { reason: '' };
    this.showReopenModal = true;
  }

  onSaveReopen(): void {
    const target = this.reopenTarget;
    if (!target) return;
    const reason = this.reopenForm.reason.trim();
    if (reason.length < 3) {
      this.notify.warn('Explica brevemente por qué se reabre este turno');
      return;
    }

    const request: IReopenCashSessionRequest = { reason };

    this.savingReopen = true;
    this.sessionsService.reopen(target.id, request).subscribe({
      next: (reopened) => {
        this.savingReopen = false;
        this.showReopenModal = false;
        this.notify.success('Turno reabierto');
        this.reopened.emit(reopened);
      },
      error: (e) => { this.savingReopen = false; this.notify.httpError(e); }
    });
  }

  private loadAndPrintCloseout(cashSessionId: number, autoPrint: boolean): void {
    this.closeout = null;
    this.showCloseoutModal = true;
    this.closeoutLoading = true;
    this.sessionsService.getCloseout(cashSessionId).subscribe({
      next: (data) => {
        this.closeout = data;
        this.closeoutLoading = false;
        // Esperar al siguiente tick para que Angular pinte `.receipt-print-area`
        // antes de disparar el diálogo de impresión del navegador.
        if (autoPrint) setTimeout(() => this.onPrintCloseout());
      },
      error: (e) => { this.closeoutLoading = false; this.showCloseoutModal = false; this.notify.httpError(e); }
    });
  }

  onPrintCloseout(): void {
    window.print();
  }

  closeoutLogoUrl(logoPath: string | null): string | null {
    return this.companiesService.getLogoUrl(logoPath);
  }
}
