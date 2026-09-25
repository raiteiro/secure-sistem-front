import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { InventoryService } from '../../services/inventory.service';
import { InventoryMovementsService } from '../../services/inventory-movements.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  IInventoryItem,
  IInventoryMovement,
  InventoryMovementType
} from '../../../../core/models/inventory.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IInventoryGroup {
  companyId: number;
  companyName: string;
  items: IInventoryItem[];
}

const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  In: 'Entrada',
  Out: 'Salida',
  Adjustment: 'Ajuste',
  Purchase: 'Compra',
  Sale: 'Venta',
  Return: 'Devolución'
};

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, PagerComponent],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss'
})
export class InventoryListComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly movementsService = inject(InventoryMovementsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  readonly movementTypeLabels = MOVEMENT_TYPE_LABELS;

  items = signal<IInventoryItem[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  lowStockOnly = signal(false);

  // ===== Modal: historial de movimientos =====
  showHistoryModal = false;
  historyLoading = signal(false);
  historyItem: IInventoryItem | null = null;
  historyMovements = signal<IInventoryMovement[]>([]);
  readonly historyPageSize = 25;
  historyPage = signal(1);
  historyTotalPages = signal(1);
  historyTotalCount = signal(0);

  ngOnInit(): void {
    this.loadInventory();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadInventory(): void {
    this.loading.set(true);
    this.inventoryService.getAll().subscribe({
      next: (data) => { this.items.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudo cargar el inventario'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  toggleLowStockOnly(): void {
    this.lowStockOnly.set(!this.lowStockOnly());
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly inventoryGroups = computed<IInventoryGroup[]>(() => {
    const filtered = this.lowStockOnly() ? this.items().filter((i) => i.isLowStock) : this.items();

    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', items: filtered }];
    }

    const byCompany = new Map<number, IInventoryItem[]>();
    for (const item of filtered) {
      const companyId = item.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(item);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        items: list
      }));
  });

  // ===== Historial =====
  onViewHistory(item: IInventoryItem): void {
    this.historyItem = item;
    this.showHistoryModal = true;
    this.historyPage.set(1);
    this.loadHistory();
  }

  private loadHistory(): void {
    if (!this.historyItem) return;
    this.historyLoading.set(true);
    this.movementsService.getAll({
      productId: this.historyItem.productId,
      warehouseId: this.historyItem.warehouseId,
      page: this.historyPage(),
      pageSize: this.historyPageSize
    }).subscribe({
      next: (result) => {
        this.historyMovements.set(result.items);
        this.historyTotalPages.set(result.totalPages);
        this.historyTotalCount.set(result.totalCount);
        this.historyLoading.set(false);
      },
      error: (e) => { this.historyLoading.set(false); this.notify.httpError(e); }
    });
  }

  onHistoryPageChange(page: number): void {
    this.historyPage.set(page);
    this.loadHistory();
  }
}
