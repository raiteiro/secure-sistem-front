import { Component, OnChanges, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { ProductionService } from '../../services/production.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IProductionOrder, ProductionOrderType } from '../../../../core/models/production.models';

export const PRODUCTION_ORDER_TYPE_LABELS: Record<ProductionOrderType, string> = {
  Production: 'Fabricación',
  Disassembly: 'Separación'
};

/** Historial paginado de órdenes de producción (fabricar y separar) de un almacén, con su detalle */
@Component({
  selector: 'app-production-history',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, PagerComponent],
  templateUrl: './production-history.component.html',
  styleUrl: './production-history.component.scss'
})
export class ProductionHistoryComponent implements OnChanges {
  private readonly productionService = inject(ProductionService);
  private readonly notify = inject(NotificationService);

  readonly warehouseId = input.required<number>();

  /** Cambiarlo recarga la primera página (ej. después de fabricar o separar) */
  readonly refreshKey = input(0);

  readonly typeLabels = PRODUCTION_ORDER_TYPE_LABELS;

  orders = signal<IProductionOrder[]>([]);
  loading = signal(true);
  typeFilter: ProductionOrderType | null = null;

  readonly pageSize = 25;
  page = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);

  showDetail = false;
  detail: IProductionOrder | null = null;

  ngOnChanges(): void {
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.productionService
      .getOrders({
        warehouseId: this.warehouseId(),
        ...(this.typeFilter ? { type: this.typeFilter } : {}),
        page: this.page(),
        pageSize: this.pageSize
      })
      .subscribe({
        next: (result) => {
          this.orders.set(result.items);
          this.totalPages.set(result.totalPages);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: (e) => { this.loading.set(false); this.notify.httpError(e); }
      });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  onViewDetail(order: IProductionOrder): void {
    this.detail = order;
    this.showDetail = true;
  }
}
