import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  ITopProduct,
  ITopProductsFilters,
  ReportGroupBy
} from '../../../../core/models/report.models';

type ReportTab = 'sales' | 'products' | 'closeouts';

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

  // ===== Productos más vendidos =====
  productsFilters: { from: string; to: string; branchId: number | null; limit: number } = {
    from: '',
    to: '',
    branchId: null,
    limit: 10
  };
  topProducts = signal<ITopProduct[]>([]);
  productsLoading = signal(true);

  // ===== Cortes de caja =====
  closeoutsFilters: { from: string; to: string; branchId: number | null; userId: number | null } = {
    from: '',
    to: '',
    branchId: null,
    userId: null
  };
  closeouts = signal<ICashierCloseout[]>([]);
  closeoutsLoading = signal(true);

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
    this.loadCashierCloseouts();
  }

  selectTab(tab: ReportTab): void {
    this.activeTab.set(tab);
  }

  branchName(branchId?: number | null): string {
    if (!branchId) return '—';
    return this.branches().find((b) => b.id === branchId)?.name ?? `#${branchId}`;
  }

  /** revenue ya incluye taxAmount; el subtotal antes de impuesto no viene del backend */
  subtotalOf(product: ITopProduct): number {
    return product.revenue - product.taxAmount;
  }

  loadSalesByPeriod(): void {
    this.salesLoading.set(true);
    this.expandedPeriods.set(new Set());
    const filters: ISalesByPeriodFilters = {
      ...(this.salesFilters.from ? { from: this.salesFilters.from } : {}),
      ...(this.salesFilters.to ? { to: this.salesFilters.to } : {}),
      ...(this.salesFilters.branchId ? { branchId: this.salesFilters.branchId } : {}),
      groupBy: this.salesFilters.groupBy
    };
    this.reportsService.getSalesByPeriod(filters).subscribe({
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

  loadTopProducts(): void {
    this.productsFilters.limit = Math.min(Math.max(this.productsFilters.limit || 10, 1), 100);
    this.productsLoading.set(true);
    const filters: ITopProductsFilters = {
      ...(this.productsFilters.from ? { from: this.productsFilters.from } : {}),
      ...(this.productsFilters.to ? { to: this.productsFilters.to } : {}),
      ...(this.productsFilters.branchId ? { branchId: this.productsFilters.branchId } : {}),
      limit: this.productsFilters.limit
    };
    this.reportsService.getTopProducts(filters).subscribe({
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

  loadCashierCloseouts(): void {
    this.closeoutsLoading.set(true);
    const filters: ICashierCloseoutFilters = {
      ...(this.closeoutsFilters.from ? { from: this.closeoutsFilters.from } : {}),
      ...(this.closeoutsFilters.to ? { to: this.closeoutsFilters.to } : {}),
      ...(this.closeoutsFilters.branchId ? { branchId: this.closeoutsFilters.branchId } : {}),
      ...(this.closeoutsFilters.userId ? { userId: this.closeoutsFilters.userId } : {})
    };
    this.reportsService.getCashierCloseouts(filters).subscribe({
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
}
