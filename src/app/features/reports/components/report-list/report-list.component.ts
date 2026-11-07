import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ReportsService } from '../../services/reports.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { UsersService } from '../../../users/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IBranch } from '../../../../core/models/branch.models';
import { IUser } from '../../../../core/models/user.models';
import {
  ICashierCloseout,
  ICashierCloseoutFilters,
  ISalesByPeriodEntry,
  ISalesByPeriodFilters,
  ISalesByPeriodReport,
  ISalesByTicketFilters,
  ISalesByTicketReport,
  ISalesByTicketRow,
  ISalesDetailFilters,
  ISalesDetailReport,
  ITopProduct,
  ITopProductsFilters,
  ReportGroupBy
} from '../../../../core/models/report.models';
import { PAYMENT_METHOD_LABELS } from '../../../../core/constants/payment-methods';

type ReportTab = 'sales' | 'products' | 'tickets' | 'closeouts' | 'detail';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss'
})
export class ReportListComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly branchesService = inject(BranchesService);
  private readonly usersService = inject(UsersService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  activeTab = signal<ReportTab>('sales');

  branches = signal<IBranch[]>([]);
  users = signal<IUser[]>([]);

  // ===== Ventas por periodo =====
  salesFilters: { from: string; to: string; branchId: number | null; groupBy: ReportGroupBy } = {
    from: '',
    to: '',
    branchId: null,
    groupBy: 'day'
  };
  salesReport = signal<ISalesByPeriodReport | null>(null);
  salesLoading = signal(true);
  expandedPeriods = signal<Set<string>>(new Set());

  // ===== Ventas por producto =====
  productsFilters: { from: string; to: string; branchId: number | null } = {
    from: '',
    to: '',
    branchId: null
  };
  topProducts = signal<ITopProduct[]>([]);
  productsLoading = signal(true);

  // ===== Ventas por ticket =====
  ticketsFilters: { from: string; to: string; branchId: number | null } = {
    from: '',
    to: '',
    branchId: null
  };
  salesByTicket = signal<ISalesByTicketReport | null>(null);
  ticketsLoading = signal(true);
  expandedTickets = signal<Set<number>>(new Set());

  // ===== Cortes de caja =====
  closeoutsFilters: { from: string; to: string; branchId: number | null; userId: number | null } = {
    from: '',
    to: '',
    branchId: null,
    userId: null
  };
  closeouts = signal<ICashierCloseout[]>([]);
  closeoutsLoading = signal(true);

  // ===== Detalle de ventas =====
  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  detailFilters: { from: string; to: string; branchId: number | null } = {
    from: '',
    to: '',
    branchId: null
  };
  salesDetail = signal<ISalesDetailReport | null>(null);
  detailLoading = signal(true);

  /** Tab cuyo PDF se está generando en el backend — null si ninguno */
  printingTab = signal<ReportTab | null>(null);

  ngOnInit(): void {
    this.branchesService.getAll().subscribe({
      next: (data) => this.branches.set(data),
      error: () => this.notify.error('No se pudieron cargar las sucursales')
    });
    this.usersService.getAll().subscribe({
      next: (data) => this.users.set(data),
      error: () => this.notify.error('No se pudieron cargar los usuarios')
    });

    this.loadSalesByPeriod();
    this.loadTopProducts();
    this.loadSalesByTicket();
    this.loadCashierCloseouts();
    this.loadSalesDetail();
  }

  selectTab(tab: ReportTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Genera el PDF del reporte de la pestaña activa en el backend (QuestPDF) y lo abre en
   * una pestaña nueva — desde el visor nativo del navegador el usuario imprime o guarda.
   * Abre la pestaña en blanco de inmediato (antes de que responda el backend) porque los
   * navegadores bloquean `window.open` si se llama después de que resuelve una promesa/
   * observable async; luego solo se le asigna la URL del PDF ya generado.
   */
  onPrint(): void {
    const tab = this.activeTab();
    this.printingTab.set(tab);
    const popup = window.open('', '_blank');

    this.pdfFor(tab).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (popup) {
          popup.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        this.printingTab.set(null);
      },
      error: (e) => {
        popup?.close();
        this.printingTab.set(null);
        this.notifyPdfError(e);
      }
    });
  }

  private pdfFor(tab: ReportTab): Observable<Blob> {
    switch (tab) {
      case 'sales':
        return this.reportsService.getSalesByPeriodPdf(this.buildSalesFilters());
      case 'products':
        return this.reportsService.getTopProductsPdf(this.buildProductsFilters());
      case 'tickets':
        return this.reportsService.getSalesByTicketPdf(this.buildTicketsFilters());
      case 'closeouts':
        return this.reportsService.getCashierCloseoutsPdf(this.buildCloseoutsFilters());
      case 'detail':
        return this.reportsService.getSalesDetailPdf(this.buildDetailFilters());
    }
  }

  /** `responseType: 'blob'` hace que un error también llegue como Blob en vez de JSON ya parseado — hay que leerlo aparte. */
  private notifyPdfError(err: unknown): void {
    const errorBody = (err as { error?: unknown })?.error;
    if (errorBody instanceof Blob && errorBody.type.includes('json')) {
      errorBody.text().then((text) => {
        try {
          const parsed = JSON.parse(text) as { message?: string };
          this.notify.error(parsed.message ?? 'No se pudo generar el PDF');
        } catch {
          this.notify.error('No se pudo generar el PDF');
        }
      });
    } else {
      this.notify.httpError(err, 'No se pudo generar el PDF');
    }
  }

  branchName(branchId?: number | null): string {
    if (!branchId) return '—';
    return this.branches().find((b) => b.id === branchId)?.name ?? `#${branchId}`;
  }

  /** revenue ya incluye taxAmount; el subtotal antes de impuesto no viene del backend */
  subtotalOf(product: ITopProduct): number {
    return product.revenue - product.taxAmount;
  }

  taxesTotal(taxes: { taxAmount: number }[]): number {
    return taxes.reduce((sum, t) => sum + t.taxAmount, 0);
  }

  private buildSalesFilters(): ISalesByPeriodFilters {
    return {
      ...(this.salesFilters.from ? { from: this.salesFilters.from } : {}),
      ...(this.salesFilters.to ? { to: this.salesFilters.to } : {}),
      ...(this.salesFilters.branchId ? { branchId: this.salesFilters.branchId } : {}),
      groupBy: this.salesFilters.groupBy
    };
  }

  loadSalesByPeriod(): void {
    this.salesLoading.set(true);
    this.expandedPeriods.set(new Set());
    this.reportsService.getSalesByPeriod(this.buildSalesFilters()).subscribe({
      next: (data) => {
        this.salesReport.set(data);
        this.salesLoading.set(false);
      },
      error: (e) => {
        this.salesLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }

  canExpandPeriod(row: ISalesByPeriodEntry): boolean {
    return row.products.length > 0;
  }

  isPeriodExpanded(period: string): boolean {
    return this.expandedPeriods().has(period);
  }

  togglePeriod(period: string): void {
    const expanded = new Set(this.expandedPeriods());
    if (expanded.has(period)) {
      expanded.delete(period);
    } else {
      expanded.add(period);
    }
    this.expandedPeriods.set(expanded);
  }

  private buildProductsFilters(): ITopProductsFilters {
    return {
      ...(this.productsFilters.from ? { from: this.productsFilters.from } : {}),
      ...(this.productsFilters.to ? { to: this.productsFilters.to } : {}),
      ...(this.productsFilters.branchId ? { branchId: this.productsFilters.branchId } : {})
    };
  }

  loadTopProducts(): void {
    this.productsLoading.set(true);
    this.reportsService.getTopProducts(this.buildProductsFilters()).subscribe({
      next: (data) => {
        this.topProducts.set(data);
        this.productsLoading.set(false);
      },
      error: (e) => {
        this.productsLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }

  private buildTicketsFilters(): ISalesByTicketFilters {
    return {
      ...(this.ticketsFilters.from ? { from: this.ticketsFilters.from } : {}),
      ...(this.ticketsFilters.to ? { to: this.ticketsFilters.to } : {}),
      ...(this.ticketsFilters.branchId ? { branchId: this.ticketsFilters.branchId } : {})
    };
  }

  loadSalesByTicket(): void {
    this.ticketsLoading.set(true);
    this.expandedTickets.set(new Set());
    this.reportsService.getSalesByTicket(this.buildTicketsFilters()).subscribe({
      next: (data) => {
        this.salesByTicket.set(data);
        this.ticketsLoading.set(false);
      },
      error: (e) => {
        this.ticketsLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }

  canExpandTicket(ticket: ISalesByTicketRow): boolean {
    return ticket.items.length > 0;
  }

  isTicketExpanded(saleId: number): boolean {
    return this.expandedTickets().has(saleId);
  }

  toggleTicket(saleId: number): void {
    const expanded = new Set(this.expandedTickets());
    if (expanded.has(saleId)) {
      expanded.delete(saleId);
    } else {
      expanded.add(saleId);
    }
    this.expandedTickets.set(expanded);
  }

  private buildCloseoutsFilters(): ICashierCloseoutFilters {
    return {
      ...(this.closeoutsFilters.from ? { from: this.closeoutsFilters.from } : {}),
      ...(this.closeoutsFilters.to ? { to: this.closeoutsFilters.to } : {}),
      ...(this.closeoutsFilters.branchId ? { branchId: this.closeoutsFilters.branchId } : {}),
      ...(this.closeoutsFilters.userId ? { userId: this.closeoutsFilters.userId } : {})
    };
  }

  loadCashierCloseouts(): void {
    this.closeoutsLoading.set(true);
    this.reportsService.getCashierCloseouts(this.buildCloseoutsFilters()).subscribe({
      next: (data) => {
        this.closeouts.set(data);
        this.closeoutsLoading.set(false);
      },
      error: (e) => {
        this.closeoutsLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }

  private buildDetailFilters(): ISalesDetailFilters {
    return {
      ...(this.detailFilters.from ? { from: this.detailFilters.from } : {}),
      ...(this.detailFilters.to ? { to: this.detailFilters.to } : {}),
      ...(this.detailFilters.branchId ? { branchId: this.detailFilters.branchId } : {})
    };
  }

  loadSalesDetail(): void {
    this.detailLoading.set(true);
    this.reportsService.getSalesDetail(this.buildDetailFilters()).subscribe({
      next: (data) => {
        this.salesDetail.set(data);
        this.detailLoading.set(false);
      },
      error: (e) => {
        this.detailLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }
}
