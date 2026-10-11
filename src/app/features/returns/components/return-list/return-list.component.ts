import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { ReturnsService } from '../../services/returns.service';
import { SalesService } from '../../../sales/services/sales.service';
import { CashSessionsService } from '../../../cash-sessions/services/cash-sessions.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { MAX_PAGE_SIZE, fetchAllPages } from '../../../../core/utils/fetch-all-pages.util';
import { quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';
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
  /** Unidad del producto vendido: decide si se pueden devolver fracciones */
  unitAbbreviation: string;
  unitDecimalPlaces: number;
  soldQuantity: number;
  /** Suma de devoluciones previas de esta línea */
  returnedQuantity: number;
  /** Lo que todavía se puede devolver: vendido − ya devuelto */
  maxQuantity: number;
  quantity: number;
  /** Lo cobrado por la línea (sin IVA / IVA), tal como quedó en la venta */
  saleSubtotal: number;
  saleTaxAmount: number;
  /** Lo ya reembolsado de la línea en devoluciones previas (sin IVA / IVA) */
  returnedSubtotal: number;
  returnedTaxAmount: number;
}

interface IRefundPreviewLine {
  subtotal: number;
  taxAmount: number;
  total: number;
}

interface IRefundPreview {
  lines: Map<number, IRefundPreviewLine>;
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** Redondeo a centavos "half away from zero", igual que `MoneyHelper.Round` del backend */
function roundMoney(value: number): number {
  return (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

/**
 * Replica el cálculo de POST /api/Returns (ReturnsController) para mostrar el reembolso antes de
 * guardar: si se devuelve todo lo que queda de la línea, se reembolsa exactamente lo que queda
 * (así varias devoluciones parciales suman al centavo lo cobrado); si es parcial, la parte
 * proporcional de lo cobrado, redondeada a centavos. Si el backend cambia la fórmula, cambiarla aquí.
 */
function refundForLine(line: IReturnLineForm): IRefundPreviewLine {
  if (line.quantity <= 0) return { subtotal: 0, taxAmount: 0, total: 0 };
  const isRemainder = line.quantity === line.maxQuantity;
  const subtotal = isRemainder
    ? roundMoney(line.saleSubtotal - line.returnedSubtotal)
    : roundMoney((line.saleSubtotal * line.quantity) / line.soldQuantity);
  const taxAmount = isRemainder
    ? roundMoney(line.saleTaxAmount - line.returnedTaxAmount)
    : roundMoney((line.saleTaxAmount * line.quantity) / line.soldQuantity);
  return { subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
}

function buildReturnLines(sale: ISale, previousReturns: IReturn[]): IReturnLineForm[] {
  const returned = new Map<number, { quantity: number; subtotal: number; taxAmount: number }>();
  for (const ret of previousReturns) {
    for (const item of ret.items) {
      const acc = returned.get(item.saleItemId) ?? { quantity: 0, subtotal: 0, taxAmount: 0 };
      acc.quantity += item.quantity;
      acc.subtotal += item.subtotal;
      acc.taxAmount += item.taxAmount;
      returned.set(item.saleItemId, acc);
    }
  }

  return sale.items.map((item) => {
    const prev = returned.get(item.id);
    return {
      saleItemId: item.id,
      productName: item.productName,
      productSku: item.productSku,
      unitAbbreviation: item.unitAbbreviation,
      unitDecimalPlaces: item.unitDecimalPlaces,
      soldQuantity: item.quantity,
      returnedQuantity: prev?.quantity ?? 0,
      maxQuantity: Math.max(item.quantity - (prev?.quantity ?? 0), 0),
      quantity: 0,
      saleSubtotal: item.subtotal,
      saleTaxAmount: item.taxAmount,
      returnedSubtotal: roundMoney(prev?.subtotal ?? 0),
      returnedTaxAmount: roundMoney(prev?.taxAmount ?? 0)
    };
  });
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
          // Las devoluciones previas dan lo ya devuelto por línea: el tope real y el reembolso exacto
          forkJoin({
            sale: this.salesService.getById(match.id),
            previousReturns: fetchAllPages((p) =>
              this.returnsService.getAll({ saleId: match.id, page: p, pageSize: MAX_PAGE_SIZE })
            )
          }).subscribe({
            next: ({ sale, previousReturns }) => {
              this.searchingSale.set(false);
              this.foundSale.set(sale);
              this.returnLines.set(buildReturnLines(sale, previousReturns));
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

  /** Vista previa del reembolso: se recalcula al cambiar cualquier cantidad */
  readonly refundPreview = computed<IRefundPreview>(() => {
    const lines = new Map<number, IRefundPreviewLine>();
    let subtotal = 0;
    let taxAmount = 0;
    for (const line of this.returnLines()) {
      const refund = refundForLine(line);
      lines.set(line.saleItemId, refund);
      subtotal += refund.subtotal;
      taxAmount += refund.taxAmount;
    }
    subtotal = roundMoney(subtotal);
    taxAmount = roundMoney(taxAmount);
    return { lines, subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
  });

  /** true si todas las líneas de la venta ya se devolvieron por completo */
  readonly fullyReturned = computed(() => this.returnLines().length > 0 && this.returnLines().every((l) => l.maxQuantity === 0));

  lineStep(line: IReturnLineForm): number {
    return quantityStep(line.unitDecimalPlaces);
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
    for (const line of this.returnLines().filter((l) => l.quantity > 0)) {
      const decimalsError = quantityDecimalsError(line.quantity, line.unitDecimalPlaces, line.productName);
      if (decimalsError) {
        this.notify.warn(decimalsError);
        return;
      }
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
