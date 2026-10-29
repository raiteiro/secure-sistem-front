import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { CloseCashSessionDialogComponent } from '../../../../shared/components/close-cash-session-dialog/close-cash-session-dialog.component';
import { CashSessionsService } from '../../services/cash-sessions.service';
import { CashRegistersService } from '../../../cash-registers/services/cash-registers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ICashSession,
  IOpenCashSessionRequest
} from '../../../../core/models/cash-session.models';
import { ICashRegister } from '../../../../core/models/cash-register.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

type IHistoryFilter = 'all' | 'open' | 'closed';

interface ICashSessionGroup {
  companyId: number;
  companyName: string;
  sessions: ICashSession[];
}

@Component({
  selector: 'app-cash-session-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, HasPermissionDirective, PagerComponent, CloseCashSessionDialogComponent],
  templateUrl: './cash-session-list.component.html',
  styleUrl: './cash-session-list.component.scss'
})
export class CashSessionListComponent implements OnInit {
  private readonly sessionsService = inject(CashSessionsService);
  private readonly cashRegistersService = inject(CashRegistersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  currentSession = signal<ICashSession | null>(null);
  currentLoading = signal(true);

  history = signal<ICashSession[]>([]);
  historyLoading = signal(true);
  filterCashRegisterId: number | null = null;
  filterStatus: IHistoryFilter = 'all';
  filterFrom = '';
  filterTo = '';

  readonly pageSize = 25;
  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);

  cashRegisters = signal<ICashRegister[]>([]);
  companies = signal<ICompany[]>([]);

  // ===== Modal: abrir turno =====
  showOpenModal = false;
  savingOpen = signal(false);
  openForm: { cashRegisterId: number | null; openingAmount: number | null } = {
    cashRegisterId: null,
    openingAmount: null
  };

  ngOnInit(): void {
    this.loadCurrent();
    this.loadHistory();
    this.loadCashRegisters();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa el historial por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly historyGroups = computed<ICashSessionGroup[]>(() => {
    const sessions = this.history();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', sessions }];
    }

    const byCompany = new Map<number, ICashSession[]>();
    for (const session of sessions) {
      const companyId = session.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(session);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        sessions: list
      }));
  });

  loadCurrent(): void {
    this.currentLoading.set(true);
    this.sessionsService.getCurrent().subscribe({
      next: (session) => { this.currentSession.set(session); this.currentLoading.set(false); },
      error: (e: HttpErrorResponse) => {
        this.currentSession.set(null);
        this.currentLoading.set(false);
        if (e.status !== 404) this.notify.httpError(e);
      }
    });
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    const filters = {
      ...(this.filterCashRegisterId ? { cashRegisterId: this.filterCashRegisterId } : {}),
      ...(this.filterStatus !== 'all' ? { isOpen: this.filterStatus === 'open' } : {}),
      ...(this.filterFrom ? { from: this.filterFrom } : {}),
      ...(this.filterTo ? { to: this.filterTo } : {}),
      page: this.page(),
      pageSize: this.pageSize
    };
    this.sessionsService.getAll(filters).subscribe({
      next: (result) => {
        this.history.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.historyLoading.set(false);
      },
      error: (e) => { this.notify.httpError(e); this.historyLoading.set(false); }
    });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadHistory();
  }

  loadCashRegisters(): void {
    this.cashRegistersService.getAll().subscribe({
      next: (data) => this.cashRegisters.set(data),
      error: () => this.notify.error('No se pudieron cargar las cajas')
    });
  }

  /** Cajas sin turno abierto ahora mismo, para el select de "Abrir turno" */
  readonly availableCashRegisters = computed<ICashRegister[]>(() =>
    this.cashRegisters().filter((cr) => !cr.hasOpenSession)
  );

  onFilterChange(): void {
    this.page.set(1);
    this.loadHistory();
  }

  // ===== Abrir turno =====
  onOpenSession(): void {
    this.openForm = { cashRegisterId: null, openingAmount: null };
    this.showOpenModal = true;
  }

  onSaveOpen(): void {
    if (!this.openForm.cashRegisterId) {
      this.notify.warn('Selecciona una caja');
      return;
    }
    if (this.openForm.openingAmount === null || this.openForm.openingAmount < 0) {
      this.notify.warn('Ingresa un monto de apertura válido');
      return;
    }

    const request: IOpenCashSessionRequest = {
      cashRegisterId: this.openForm.cashRegisterId,
      openingAmount: this.openForm.openingAmount
    };

    this.savingOpen.set(true);
    this.sessionsService.open(request).subscribe({
      next: () => {
        this.savingOpen.set(false);
        this.showOpenModal = false;
        this.notify.success('Turno abierto');
        this.loadCurrent();
        this.page.set(1);
        this.loadHistory();
        this.loadCashRegisters();
      },
      error: (e) => { this.savingOpen.set(false); this.notify.httpError(e); }
    });
  }

  /** El turno se cerró desde el diálogo compartido — recargar estado actual, historial y cajas */
  onSessionClosed(): void {
    this.loadCurrent();
    this.page.set(1);
    this.loadHistory();
    this.loadCashRegisters();
  }
}
