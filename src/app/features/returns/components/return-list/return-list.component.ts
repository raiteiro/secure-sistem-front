import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { Router } from '@angular/router';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { ReturnsService } from '../../services/returns.service';
import { SalesService } from '../../../sales/services/sales.service';
import { CashSessionsService } from '../../../cash-sessions/services/cash-sessions.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ICashSession } from '../../../../core/models/cash-session.models';
import { ICompany } from '../../../../core/models/company.models';
import { ISale } from '../../../../core/models/sale.models';
import { IReturn, IReturnRequest, RefundMethod } from '../../../../core/models/return.models';

interface IReturnGroup {
  companyId: number;
  companyName: string;
  returns: IReturn[];
}

interface IReturnLineForm {
  saleItemId: number;
  productName: string;
  productSku: string | null;
  maxQuantity: number;
  quantity: number;
}

const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  Cash: 'Efectivo',
  Card: 'Tarjeta',
  Other: 'Otro'
};

@Component({
  selector: 'app-return-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, HasPermissionDirective, PagerComponent],
  templateUrl: './return-list.component.html',
  styleUrl: './return-list.component.scss'
})
export class ReturnListComponent implements OnInit {
  private readonly returnsService = inject(ReturnsService);
  private readonly salesService = inject(SalesService);
  private readonly cashSessionsService = inject(CashSessionsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly refundMethodLabels = REFUND_METHOD_LABELS;

  // ===== Turno de caja (necesario para procesar una devolución nueva) =====
  currentSession = signal<ICashSession | null>(null);
  sessionLoading = signal(true);

  // ===== Historial =====
  returns = signal<IReturn[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  historyFilterFrom = '';
  historyFilterTo = '';

  readonly pageSize = 25;
  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);

  ngOnInit(): void {
    this.sessionLoading.set(true);
    this.cashSessionsService.getCurrent().subscribe({
      next: (session) => { this.currentSession.set(session); this.sessionLoading.set(false); },
      error: (e: HttpErrorResponse) => {
        this.currentSession.set(null);
        this.sessionLoading.set(false);
        if (e.status !== 404) this.notify.httpError(e);
      }
    });

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }

    this.loadReturns();
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  loadReturns(): void {
    this.loading.set(true);
    const filters = {
      ...(this.historyFilterFrom ? { from: this.historyFilterFrom } : {}),
      ...(this.historyFilterTo ? { to: this.historyFilterTo } : {}),
      page: this.page(),
      pageSize: this.pageSize
    };
    this.returnsService.getAll(filters).subscribe({
      next: (result) => {
        this.returns.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: (e) => { this.loading.set(false); this.notify.httpError(e); }
    });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadReturns();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadReturns();
  }

  /** Separa el historial por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly returnGroups = computed<IReturnGroup[]>(() => {
    const all = this.returns();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', returns: all }];
    }

    const byCompany = new Map<number, IReturn[]>();
    for (const ret of all) {
      const list = byCompany.get(ret.companyId) ?? [];
      list.push(ret);
      byCompany.set(ret.companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        returns: list
      }));
  });

  goToCashSessions(): void {
    this.router.navigate(['/caja/turnos']);
  }

  // ===== Modal: nueva devolución =====
  showNewModal = false;
  saving = signal(false);

  folioSearch: number | null = null;
  searchingSale = signal(false);
  foundSale = signal<ISale | null>(null);
  returnLines = signal<IReturnLineForm[]>([]);

  returnForm: { refundMethod: RefundMethod; reason: string } = { refundMethod: 'Cash', reason: '' };

  onOpenNewReturn(): void {
    this.folioSearch = null;
    this.searchingSale.set(false);
    this.foundSale.set(null);
    this.returnLines.set([]);
    this.returnForm = { refundMethod: 'Cash', reason: '' };
    this.showNewModal = true;
  }

  onSearchSale(): void {
    if (!this.folioSearch || this.folioSearch <= 0) {
      this.notify.warn('Ingresa un número de folio válido');
      return;
    }

    this.searchingSale.set(true);
    this.foundSale.set(null);
    this.searchSaleByFolioPage(this.folioSearch, 1);
  }

  /**
   * GET /api/Sales ya no trae todas las ventas de un jalón — está paginado. Como no hay un filtro
   * por folioNumber en el backend, se recorre página por página (pageSize al tope, 100) hasta
   * encontrarlo o agotar `MAX_PAGES_TO_SEARCH`. Es un parche: lo correcto es pedirle al backend un
   * filtro `folioNumber` exacto en GET /api/Sales para no tener que barrer nada.
   */
  private static readonly MAX_PAGES_TO_SEARCH = 20;

  private searchSaleByFolioPage(folio: number, page: number): void {
    this.salesService.getAll({ status: 'Completed', page, pageSize: 100 }).subscribe({
      next: (result) => {
        const match = result.items.find((s) => s.folioNumber === folio);
        if (match) {
          this.salesService.getById(match.id).subscribe({
            next: (sale) => {
              this.searchingSale.set(false);
              this.foundSale.set(sale);
              this.returnLines.set(
                sale.items.map((item) => ({
                  saleItemId: item.id,
                  productName: item.productName,
                  productSku: item.productSku,
                  maxQuantity: item.quantity,
                  quantity: 0
                }))
              );
            },
            error: (e) => { this.searchingSale.set(false); this.notify.httpError(e); }
          });
          return;
        }

        if (page < result.totalPages && page < ReturnListComponent.MAX_PAGES_TO_SEARCH) {
          this.searchSaleByFolioPage(folio, page + 1);
          return;
        }

        this.searchingSale.set(false);
        this.notify.warn(`No se encontró una venta completada con folio #${folio}`);
      },
      error: (e) => { this.searchingSale.set(false); this.notify.httpError(e); }
    });
  }

  onChangeLineQuantity(saleItemId: number, quantity: number): void {
    this.returnLines.update((lines) =>
      lines.map((l) =>
        l.saleItemId === saleItemId
          ? { ...l, quantity: Math.min(Math.max(quantity || 0, 0), l.maxQuantity) }
          : l
      )
    );
  }

  onSearchAnotherSale(): void {
    this.foundSale.set(null);
    this.returnLines.set([]);
    this.folioSearch = null;
  }

  onSaveReturn(): void {
    const sale = this.foundSale();
    const session = this.currentSession();
    if (!sale || !session) return;

    const items = this.returnLines()
      .filter((l) => l.quantity > 0)
      .map((l) => ({ saleItemId: l.saleItemId, quantity: l.quantity }));

    if (items.length === 0) {
      this.notify.warn('Indica la cantidad a devolver de al menos un producto');
      return;
    }

    const request: IReturnRequest = {
      saleId: sale.id,
      cashSessionId: session.id,
      refundMethod: this.returnForm.refundMethod,
      reason: this.returnForm.reason.trim() || null,
      items
    };

    this.saving.set(true);
    this.returnsService.create(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.showNewModal = false;
        this.notify.success('Devolución registrada');
        this.page.set(1);
        this.loadReturns();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Modal: detalle de una devolución ya registrada =====
  showDetailModal = false;
  detailReturn: IReturn | null = null;

  onViewDetail(ret: IReturn): void {
    this.detailReturn = ret;
    this.showDetailModal = true;
  }
}
