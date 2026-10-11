import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { ComboAvailabilityTableComponent } from '../../../inventory/components/combo-availability-table/combo-availability-table.component';
import { WarehousesService } from '../../services/warehouses.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { InventoryMovementsService } from '../../../inventory/services/inventory-movements.service';
import { ProductsService } from '../../../products/services/products.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IWarehouse } from '../../../../core/models/warehouse.models';
import {
  IComboAvailability,
  IInventoryItem,
  IInventoryMovement,
  IInventoryMovementRequest,
  ManualInventoryMovementType
} from '../../../../core/models/inventory.models';
import { IProduct, ProductKind } from '../../../../core/models/product.models';
import {
  INVENTORY_MOVEMENT_TYPE_LABELS,
  signedMovementQuantity
} from '../../../../core/utils/inventory-movement.util';
import { NotificationService } from '../../../../core/services/notification.service';
import { quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';
import { ProduceDialogComponent } from '../produce-dialog/produce-dialog.component';
import { DisassembleDialogComponent } from '../disassemble-dialog/disassemble-dialog.component';
import { ProductionHistoryComponent } from '../production-history/production-history.component';

/** Pestañas del detalle: stock de productos (con combos), stock de insumos, e historial de producción */
type WarehouseTab = 'products' | 'supplies' | 'production';

@Component({
  selector: 'app-warehouse-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DialogModule,
    HasPermissionDirective,
    PagerComponent,
    ComboAvailabilityTableComponent,
    ProduceDialogComponent,
    DisassembleDialogComponent,
    ProductionHistoryComponent
  ],
  templateUrl: './warehouse-detail.component.html',
  styleUrl: './warehouse-detail.component.scss'
})
export class WarehouseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly warehousesService = inject(WarehousesService);
  private readonly inventoryService = inject(InventoryService);
  private readonly movementsService = inject(InventoryMovementsService);
  private readonly productsService = inject(ProductsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  readonly movementTypeLabels = INVENTORY_MOVEMENT_TYPE_LABELS;

  readonly warehouseId = Number(this.route.snapshot.paramMap.get('id'));

  activeTab = signal<WarehouseTab>('products');

  warehouse = signal<IWarehouse | null>(null);
  loadingWarehouse = signal(true);
  companyName = signal<string | null>(null);

  items = signal<IInventoryItem[]>([]);
  loadingItems = signal(true);

  combos = signal<IComboAvailability[]>([]);
  loadingCombos = signal(true);

  allProducts = signal<IProduct[]>([]);

  ngOnInit(): void {
    this.loadWarehouse();
    this.loadItems();
    this.loadProducts();
  }

  private loadProducts(): void {
    this.productsService.getAll().subscribe({
      next: (data) => this.allProducts.set(data),
      error: () => this.notify.error('No se pudieron cargar los productos')
    });
  }

  /** Filas de la pestaña activa: productos (incluye fabricados) o insumos */
  readonly visibleItems = computed<IInventoryItem[]>(() => {
    const kind: ProductKind = this.activeTab() === 'supplies' ? 'Supply' : 'Product';
    return this.items().filter((i) => i.productKind === kind);
  });

  readonly productCount = computed(() => this.items().filter((i) => i.productKind === 'Product').length);
  readonly supplyCount = computed(() => this.items().filter((i) => i.productKind === 'Supply').length);

  /** Insumos activos de la empresa del almacén, para las recetas */
  readonly companySupplies = computed<IProduct[]>(() => {
    const companyId = this.warehouse()?.companyId;
    return this.allProducts().filter((p) => p.kind === 'Supply' && p.isActive && (!companyId || p.companyId === companyId));
  });

  /** Stock de cada insumo en este almacén, por productId */
  readonly supplyStock = computed<Record<number, number>>(() => {
    const stock: Record<number, number> = {};
    for (const item of this.items()) {
      if (item.productKind === 'Supply') stock[item.productId] = item.quantity;
    }
    return stock;
  });

  /** `step` del input de cantidad al agregar: el de la unidad del producto elegido */
  addStep(): number {
    return quantityStep(this.allProducts().find((p) => p.id === this.addForm.productId)?.unitDecimalPlaces);
  }

  /** `step` de un input de cantidad sobre una fila de inventario (movimiento, stock mínimo) */
  itemStep(item: IInventoryItem | null): number {
    return quantityStep(item?.unitDecimalPlaces);
  }

  selectTab(tab: WarehouseTab): void {
    this.activeTab.set(tab);
  }

  // ===== Producción: fabricar / separar =====
  showProduceDialog = signal(false);
  disassembleItem = signal<IInventoryItem | null>(null);
  /** Se incrementa para que el historial de producción recargue */
  productionRefreshKey = signal(0);

  /** Tras fabricar, separar, dar de alta un fabricado o editar una receta */
  onProductionChanged(): void {
    this.showProduceDialog.set(false);
    this.disassembleItem.set(null);
    this.loadItems();
    this.loadProducts();
    this.productionRefreshKey.update((k) => k + 1);
  }

  private loadWarehouse(): void {
    this.loadingWarehouse.set(true);
    this.warehousesService.getById(this.warehouseId).subscribe({
      next: (warehouse) => {
        this.warehouse.set(warehouse);
        this.loadingWarehouse.set(false);
        if (this.authService.isSystemAdmin()) {
          this.companiesService.getAll().subscribe({
            next: (companies) => {
              const company = companies.find((c) => c.id === warehouse.companyId);
              this.companyName.set(company?.name ?? `#${warehouse.companyId}`);
            },
            error: () => {}
          });
        }
      },
      error: (e) => { this.loadingWarehouse.set(false); this.notify.httpError(e); }
    });
  }

  private loadItems(): void {
    this.loadingItems.set(true);
    this.inventoryService.getAll({ warehouseId: this.warehouseId }).subscribe({
      next: (data) => { this.items.set(data); this.loadingItems.set(false); },
      error: () => { this.notify.error('No se pudo cargar el inventario del almacén'); this.loadingItems.set(false); }
    });
    // Cualquier cambio de stock de un componente cambia cuántos combos se pueden vender
    this.loadCombos();
  }

  private loadCombos(): void {
    this.loadingCombos.set(true);
    this.inventoryService.getComboAvailability({ warehouseId: this.warehouseId }).subscribe({
      next: (data) => { this.combos.set(data); this.loadingCombos.set(false); },
      error: () => { this.notify.error('No se pudo calcular la disponibilidad de combos'); this.loadingCombos.set(false); }
    });
  }

  goBack(): void {
    this.router.navigate(['/catalogo/almacenes']);
  }

  /**
   * Productos (o insumos, según la pestaña) activos de la empresa que todavía no tienen registro de
   * inventario en este almacén. Sin combos: no llevan stock propio (el backend rechaza el
   * movimiento), su disponibilidad sale de sus componentes — ver la tabla de combos.
   */
  readonly availableProductsToAdd = computed<IProduct[]>(() => {
    const companyId = this.warehouse()?.companyId;
    const kind: ProductKind = this.activeTab() === 'supplies' ? 'Supply' : 'Product';
    const stockedProductIds = new Set(this.items().map((i) => i.productId));
    return this.allProducts().filter(
      (p) =>
        p.isActive &&
        !p.isCombo &&
        p.kind === kind &&
        (!companyId || p.companyId === companyId) &&
        !stockedProductIds.has(p.id)
    );
  });

  /**
   * El producto ya trae su proveedor/consignador desde que se da de alta (ver Productos) — al
   * registrar una compra no se vuelve a preguntar, se usa lo que ya tiene asignado el producto.
   */
  productOf(item: IInventoryItem): IProduct | undefined {
    return this.allProducts().find((p) => p.id === item.productId);
  }

  // ===== Modal: agregar producto (alta con una entrada inicial) =====
  showAddModal = false;
  savingAdd = signal(false);
  addForm: { productId: number | null; quantity: number | null; notes: string } = {
    productId: null,
    quantity: null,
    notes: ''
  };

  onAddProduct(): void {
    this.addForm = { productId: null, quantity: null, notes: '' };
    this.showAddModal = true;
  }

  onSaveAdd(): void {
    if (!this.addForm.productId) {
      this.notify.warn('Selecciona un producto');
      return;
    }
    if (this.addForm.quantity === null || this.addForm.quantity <= 0) {
      this.notify.warn('Ingresa una cantidad mayor a cero');
      return;
    }
    const product = this.allProducts().find((p) => p.id === this.addForm.productId);
    const decimalsError = product
      ? quantityDecimalsError(this.addForm.quantity, product.unitDecimalPlaces, product.name, product.unitName)
      : null;
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }

    const request: IInventoryMovementRequest = {
      productId: this.addForm.productId,
      warehouseId: this.warehouseId,
      type: 'In',
      quantity: this.addForm.quantity,
      notes: this.addForm.notes || null
    };

    this.savingAdd.set(true);
    this.movementsService.create(request).subscribe({
      next: () => {
        this.savingAdd.set(false);
        this.showAddModal = false;
        this.notify.success(this.activeTab() === 'supplies' ? 'Insumo agregado al almacén' : 'Producto agregado al almacén');
        this.loadItems();
      },
      error: (e) => { this.savingAdd.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Modal: stock mínimo =====
  showMinStockModal = false;
  savingMinStock = signal(false);
  minStockItem: IInventoryItem | null = null;
  minStockForm: { hasMinStock: boolean; minStock: number | null } = { hasMinStock: false, minStock: null };

  onEditMinStock(item: IInventoryItem): void {
    this.minStockItem = item;
    this.minStockForm = { hasMinStock: item.minStock !== null, minStock: item.minStock };
    this.showMinStockModal = true;
  }

  onSaveMinStock(): void {
    if (!this.minStockItem) return;
    if (this.minStockForm.hasMinStock && (this.minStockForm.minStock === null || this.minStockForm.minStock < 0)) {
      this.notify.warn('Ingresa un stock mínimo válido');
      return;
    }
    if (this.minStockForm.hasMinStock && this.minStockForm.minStock !== null) {
      const item = this.minStockItem;
      const decimalsError = quantityDecimalsError(this.minStockForm.minStock, item.unitDecimalPlaces, item.productName);
      if (decimalsError) {
        this.notify.warn(decimalsError);
        return;
      }
    }

    this.savingMinStock.set(true);
    const minStock = this.minStockForm.hasMinStock ? this.minStockForm.minStock : null;
    this.inventoryService.setMinStock(this.minStockItem.id, { minStock }).subscribe({
      next: () => {
        this.savingMinStock.set(false);
        this.showMinStockModal = false;
        this.notify.success('Stock mínimo actualizado');
        this.loadItems();
      },
      error: (e) => { this.savingMinStock.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Modal: registrar movimiento (sobre un producto ya existente en este almacén) =====
  showMovementModal = false;
  savingMovement = signal(false);
  movementItem: IInventoryItem | null = null;
  movementForm: { type: ManualInventoryMovementType; quantity: number | null; direction: 'increase' | 'decrease'; notes: string } = {
    type: 'In',
    quantity: null,
    direction: 'increase',
    notes: ''
  };

  onRegisterMovement(item: IInventoryItem): void {
    this.movementItem = item;
    this.movementForm = { type: 'In', quantity: null, direction: 'increase', notes: '' };
    this.showMovementModal = true;
  }

  onSaveMovement(): void {
    if (!this.movementItem) return;
    const magnitude = this.movementForm.quantity;
    if (magnitude === null || magnitude <= 0) {
      this.notify.warn('Ingresa una cantidad mayor a cero');
      return;
    }
    const decimalsError = quantityDecimalsError(magnitude, this.movementItem.unitDecimalPlaces, this.movementItem.productName);
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }

    const type = this.movementForm.type;
    const quantity = signedMovementQuantity(type, magnitude, this.movementForm.direction);
    /** El proveedor viene del producto, no se captura en este formulario (ver `productOf`) */
    const supplierId = type === 'Purchase' ? this.productOf(this.movementItem)?.supplierId ?? null : undefined;

    const request: IInventoryMovementRequest = {
      productId: this.movementItem.productId,
      warehouseId: this.movementItem.warehouseId,
      type,
      quantity,
      notes: this.movementForm.notes || null,
      ...(supplierId !== undefined ? { supplierId } : {})
    };

    this.savingMovement.set(true);
    this.movementsService.create(request).subscribe({
      next: () => {
        this.savingMovement.set(false);
        this.showMovementModal = false;
        this.notify.success('Movimiento registrado');
        this.loadItems();
      },
      error: (e) => { this.savingMovement.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Modal: historial =====
  showHistoryModal = false;
  historyLoading = signal(false);
  historyItem: IInventoryItem | null = null;
  historyMovements = signal<IInventoryMovement[]>([]);
  readonly historyPageSize = 25;
  historyPage = signal(1);
  historyTotalPages = signal(1);
  historyTotalCount = signal(0);

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
