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
  IComboAvailability,
  IInventoryItem,
  IInventoryMovement
} from '../../../../core/models/inventory.models';
import { INVENTORY_MOVEMENT_TYPE_LABELS } from '../../../../core/utils/inventory-movement.util';
import { ComboAvailabilityTableComponent } from '../combo-availability-table/combo-availability-table.component';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IInventoryGroup {
  companyId: number;
  companyName: string;
  items: IInventoryItem[];
  combos: IComboAvailability[];
}

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, PagerComponent, ComboAvailabilityTableComponent],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss'
})
export class InventoryListComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly movementsService = inject(InventoryMovementsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  readonly movementTypeLabels = INVENTORY_MOVEMENT_TYPE_LABELS;

  items = signal<IInventoryItem[]>([]);
  loading = signal(true);
  combos = signal<IComboAvailability[]>([]);
  loadingCombos = signal(true);
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

    this.loadingCombos.set(true);
    this.inventoryService.getComboAvailability().subscribe({
      next: (data) => { this.combos.set(data); this.loadingCombos.set(false); },
      error: () => { this.notify.error('No se pudo calcular la disponibilidad de combos'); this.loadingCombos.set(false); }
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
    const lowStockOnly = this.lowStockOnly();
    const filtered = lowStockOnly ? this.items().filter((i) => i.isLowStock) : this.items();
    // Un combo no tiene stock mínimo propio: con el filtro de bajo stock se muestran los que no se pueden vender
    const combos = lowStockOnly ? this.combos().filter((c) => c.availableQuantity <= 0) : this.combos();

    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', items: filtered, combos }];
    }

    const byCompany = new Map<number, IInventoryGroup>();
    const groupOf = (companyId: number): IInventoryGroup => {
      const existing = byCompany.get(companyId);
      if (existing) return existing;
      const created: IInventoryGroup = { companyId, companyName: this.companyName(companyId), items: [], combos: [] };
      byCompany.set(companyId, created);
      return created;
    };
    for (const item of filtered) groupOf(item.companyId ?? 0).items.push(item);
    for (const combo of combos) groupOf(combo.companyId).combos.push(combo);

    return [...byCompany.values()].sort((a, b) => a.companyId - b.companyId);
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
