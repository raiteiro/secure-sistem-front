import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { floorToAllowedDecimals, quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';
import { PAYMENT_METHOD_LABELS } from '../../../../core/constants/payment-methods';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { CloseCashSessionDialogComponent } from '../../../../shared/components/close-cash-session-dialog/close-cash-session-dialog.component';
import { SalesService } from '../../services/sales.service';
import { ProductsService } from '../../../products/services/products.service';
import { CashSessionsService } from '../../../cash-sessions/services/cash-sessions.service';
import { CashRegistersService } from '../../../cash-registers/services/cash-registers.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { CustomersService } from '../../../customers/services/customers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ICashSession } from '../../../../core/models/cash-session.models';
import { IProduct } from '../../../../core/models/product.models';
import { IBranch } from '../../../../core/models/branch.models';
import { IWarehouse } from '../../../../core/models/warehouse.models';
import { ICustomer } from '../../../../core/models/customer.models';
import { ICompany } from '../../../../core/models/company.models';
import {
  ICancelSaleErrorResponse,
  ICancelSaleRequest,
  ISale,
  ISaleFilters,
  ISaleReceipt,
  ISaleRequest,
  PaymentMethod
} from '../../../../core/models/sale.models';

interface ISaleGroup {
  companyId: number;
  companyName: string;
  sales: ISale[];
}

/** Formatea a 'YYYY-MM-DD' en hora local (evita el corrimiento de día de toISOString, que usa UTC) */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Primer y último día del mes en curso, para precargar el filtro de historial */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

interface IProductCategoryChip {
  /** `0` = bucket sintético "Sin categoría" */
  id: number;
  name: string;
}

interface IProductCatalogGroup {
  categoryId: number;
  categoryName: string;
  products: IProduct[];
}

interface ICartLine {
  productId: number;
  productName: string;
  productSku: string | null;
  price: number;
  taxRateValue: number | null;
  /** Unidad del producto: decide si la cantidad acepta decimales */
  unitAbbreviation: string;
  unitDecimalPlaces: number;
  quantity: number;
  /** 0-100. El backend sigue recibiendo el descuento en pesos (ver onCreateSale) — este % es
   * solo la forma en que se captura en el POS, para no depender de que el cajero calcule a mano
   * cuánto es "15% de este producto" en pesos. */
  discountPercent: number;
}

interface ICartLineComputed extends ICartLine {
  lineGross: number;
  discountAmount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

interface IPaymentLine {
  /** Solo UI, para hacer track en el @for — nunca se manda al backend */
  id: number;
  method: PaymentMethod;
  amount: number;
  /** Solo UI, para calcular el cambio de un pago en efectivo — nunca se manda al backend */
  receivedCash: number | null;
}

/** Un componente de combo y cuánto lleva por cada combo */
interface IComboComponentUsage {
  productId: number;
  perCombo: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-sale-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ConfirmDialogModule, HasPermissionDirective, PagerComponent, CloseCashSessionDialogComponent],
  providers: [ConfirmationService],
  templateUrl: './sale-pos.component.html',
  styleUrl: './sale-pos.component.scss'
})
export class SalePosComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly productsService = inject(ProductsService);
  private readonly cashSessionsService = inject(CashSessionsService);
  private readonly cashRegistersService = inject(CashRegistersService);
  private readonly branchesService = inject(BranchesService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly customersService = inject(CustomersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;

  activeTab = signal<'new' | 'history'>('new');

  // ===== Turno de caja =====
  currentSession = signal<ICashSession | null>(null);
  sessionLoading = signal(true);

  // ===== Catálogos (ya filtrados a la empresa del turno) =====
  branches = signal<IBranch[]>([]);
  warehouses = signal<IWarehouse[]>([]);
  customers = signal<ICustomer[]>([]);
  products = signal<IProduct[]>([]);

  selectedBranchId: number | null = null;
  selectedWarehouseId: number | null = null;
  selectedCustomerId: number | null = null;

  productSearch = signal('');
  /** `null` = todas las categorías; `0` = el bucket sintético "Sin categoría" */
  categoryFilter = signal<number | null>(null);

  cartItems = signal<ICartLine[]>([]);
  paymentLines = signal<IPaymentLine[]>([]);
  private nextPaymentLineId = 0;

  saving = signal(false);

  // ===== Existencias del almacén seleccionado =====
  /** Stock por productId (productos normales y fabricados). Los que no aparecen tienen 0 */
  private readonly stockByProduct = signal<Record<number, number>>({});
  /** Componentes de cada combo, por id del combo — un combo no tiene stock propio, descuenta estos */
  private readonly comboComponents = signal<Record<number, IComboComponentUsage[]>>({});
  stockLoading = signal(false);
  /** Almacén al que corresponden las existencias cargadas (null = ninguno seleccionado) */
  stockWarehouseId = signal<number | null>(null);

  // ===== Historial (independiente del turno — visible para cualquiera, incl. sisAdmin sin turno propio) =====
  history = signal<ISale[]>([]);
  historyLoading = signal(false);
  historyFilterBranchId: number | null = null;
  historyFilterCustomerId: number | null = null;
  historyFilterFrom = currentMonthRange().from;
  historyFilterTo = currentMonthRange().to;
  historyBranches = signal<IBranch[]>([]);
  historyCustomers = signal<ICustomer[]>([]);
  companies = signal<ICompany[]>([]);

  readonly historyPageSize = 25;
  historyPage = signal(1);
  historyTotalPages = signal(1);
  historyTotalCount = signal(0);

  ngOnInit(): void {
    this.loadCurrentSession();

    this.branchesService.getAll().subscribe({
      next: (data) => this.historyBranches.set(data),
      error: () => this.notify.error('No se pudieron cargar las sucursales')
    });
    this.customersService.getAll().subscribe({
      next: (data) => this.historyCustomers.set(data),
      error: () => this.notify.error('No se pudieron cargar los clientes')
    });
    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
    this.loadHistory();
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa el historial por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly historyGroups = computed<ISaleGroup[]>(() => {
    const sales = this.history();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', sales }];
    }

    const byCompany = new Map<number, ISale[]>();
    for (const sale of sales) {
      const companyId = sale.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(sale);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        sales: list
      }));
  });

  private loadCurrentSession(): void {
    this.sessionLoading.set(true);
    this.cashSessionsService.getCurrent().subscribe({
      next: (session) => {
        this.currentSession.set(session);
        this.sessionLoading.set(false);
        this.loadCatalogsForCompany(session.companyId);
        this.resolveDefaultBranch(session);
      },
      error: (e: HttpErrorResponse) => {
        this.currentSession.set(null);
        this.sessionLoading.set(false);
        if (e.status !== 404) this.notify.httpError(e);
      }
    });
  }

  private loadCatalogsForCompany(companyId: number): void {
    this.branchesService.getAll().subscribe({
      next: (data) => this.branches.set(data.filter((b) => b.companyId === companyId)),
      error: () => this.notify.error('No se pudieron cargar las sucursales')
    });
    this.warehousesService.getAll().subscribe({
      next: (data) => this.warehouses.set(data.filter((w) => w.companyId === companyId)),
      error: () => this.notify.error('No se pudieron cargar los almacenes')
    });
    this.customersService.getAll().subscribe({
      next: (data) => this.customers.set(data.filter((c) => c.companyId === companyId)),
      error: () => this.notify.error('No se pudieron cargar los clientes')
    });
    this.productsService.getAll().subscribe({
      // Los insumos no se venden (el backend rechaza la venta): no aparecen en el catálogo del POS
      next: (data) => this.products.set(data.filter((p) => p.companyId === companyId && p.isActive && p.kind !== 'Supply')),
      error: () => this.notify.error('No se pudieron cargar los productos')
    });
  }

  /** Preselecciona la sucursal (y su almacén) de la caja donde está abierto el turno */
  private resolveDefaultBranch(session: ICashSession): void {
    this.cashRegistersService.getAll().subscribe({
      next: (registers) => {
        const register = registers.find((r) => r.id === session.cashRegisterId);
        if (!register) return;
        this.selectedBranchId = register.branchId;
        const warehouse = this.warehouses().find((w) => w.branchId === register.branchId);
        if (warehouse) {
          this.selectedWarehouseId = warehouse.id;
          this.loadStock();
        }
      },
      error: () => {}
    });
  }

  onBranchChange(): void {
    this.selectedWarehouseId = null;
    this.loadStock();
  }

  onWarehouseChange(): void {
    this.loadStock();
  }

  /** Existencias del almacén seleccionado: stock de productos + componentes de combos */
  loadStock(): void {
    const warehouseId = this.selectedWarehouseId;
    this.stockWarehouseId.set(warehouseId);
    if (!warehouseId) {
      this.stockByProduct.set({});
      this.comboComponents.set({});
      return;
    }

    this.stockLoading.set(true);
    forkJoin({
      inventory: this.inventoryService.getAll({ warehouseId }),
      combos: this.inventoryService.getComboAvailability({ warehouseId })
    }).subscribe({
      next: ({ inventory, combos }) => {
        // Si mientras cargaba se eligió otro almacén, esta respuesta ya no aplica
        if (this.selectedWarehouseId !== warehouseId) return;
        const stock: Record<number, number> = {};
        for (const item of inventory) stock[item.productId] = item.quantity;
        const components: Record<number, IComboComponentUsage[]> = {};
        for (const combo of combos) {
          components[combo.comboProductId] = combo.components.map((c) => ({
            productId: c.componentProductId,
            perCombo: c.quantityPerCombo
          }));
          // Un componente inactivo hace que el backend rechace la venta del combo: cuenta como sin stock
          for (const c of combo.components) {
            if (!c.isActive) stock[c.componentProductId] = 0;
          }
        }
        this.stockByProduct.set(stock);
        this.comboComponents.set(components);
        this.stockLoading.set(false);
      },
      error: (e) => {
        this.stockLoading.set(false);
        this.notify.httpError(e);
      }
    });
  }

  /** Cuánto stock de cada producto base consume el carrito (los combos cuentan por sus componentes) */
  private readonly cartUsage = computed<Record<number, number>>(() => {
    const combos = this.comboComponents();
    const usage: Record<number, number> = {};
    for (const line of this.cartItems()) {
      const components = combos[line.productId];
      if (components) {
        for (const c of components) usage[c.productId] = (usage[c.productId] ?? 0) + c.perCombo * line.quantity;
      } else {
        usage[line.productId] = (usage[line.productId] ?? 0) + line.quantity;
      }
    }
    return usage;
  });

  /**
   * Cuántas unidades más de cada producto se pueden agregar al carrito con el stock del almacén,
   * descontando lo que ya consume el carrito. Un combo sin componentes activos da 0, igual que el backend.
   */
  readonly availableByProduct = computed<Record<number, number>>(() => {
    const stock = this.stockByProduct();
    const combos = this.comboComponents();
    const usage = this.cartUsage();
    const free = (productId: number) => Math.max((stock[productId] ?? 0) - (usage[productId] ?? 0), 0);

    const available: Record<number, number> = {};
    for (const product of this.products()) {
      if (!product.tracksStock) {
        // Se vende sin necesidad de existencias: siempre "disponible", sin tope de stock.
        available[product.id] = Number.MAX_SAFE_INTEGER;
      } else if (product.isCombo) {
        const components = combos[product.id] ?? [];
        available[product.id] = components.length === 0
          ? 0
          : Math.min(...components.map((c) => Math.floor(free(c.productId) / c.perCombo)));
      } else {
        // Se recorta a los decimales de la unidad: con 2.7 de algo que se vende por pieza, se pueden 2
        available[product.id] = floorToAllowedDecimals(free(product.id), product.unitDecimalPlaces);
      }
    }
    return available;
  });

  availableFor(productId: number): number {
    return this.availableByProduct()[productId] ?? 0;
  }

  /** Productos base cuyo consumo en el carrito supera el stock (ej. después de cambiar de almacén) */
  readonly cartStockIssues = computed<string[]>(() => {
    if (!this.stockWarehouseId()) return [];
    const stock = this.stockByProduct();
    const products = this.products();
    const names = new Map(products.map((p) => [p.id, p.name]));
    // Un producto base (no un combo) que no requiere existencias nunca es "problema de stock",
    // aunque el carrito consuma más de lo que haya en Inventory (o no exista fila ahí).
    const tracksStock = new Map(products.map((p) => [p.id, p.tracksStock]));
    return Object.entries(this.cartUsage())
      .filter(([productId, used]) => tracksStock.get(Number(productId)) !== false && used > (stock[Number(productId)] ?? 0))
      .map(([productId]) => names.get(Number(productId)) ?? `#${productId}`);
  });

  /**
   * Método normal, NO `computed()`: depende de `selectedBranchId`, que es una propiedad plana (no un
   * signal) — un `computed()` se quedaba congelado en la sucursal de la primera lectura.
   */
  availableWarehouses(): IWarehouse[] {
    if (!this.selectedBranchId) return this.warehouses();
    return this.warehouses().filter((w) => w.branchId === this.selectedBranchId || w.branchId === null);
  }

  readonly filteredProducts = computed<IProduct[]>(() => {
    const term = this.productSearch().trim().toLowerCase();
    const categoryId = this.categoryFilter();
    return this.products().filter((p) => {
      if (categoryId !== null && (p.categoryId ?? 0) !== categoryId) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || (p.sku ?? '').toLowerCase().includes(term);
    });
  });

  /** Categorías presentes en el catálogo de la empresa, para las píldoras de filtro */
  readonly categoryChips = computed<IProductCategoryChip[]>(() => {
    const byId = new Map<number, string>();
    for (const p of this.products()) {
      const id = p.categoryId ?? 0;
      byId.set(id, p.categoryName ?? 'Sin categoría');
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  });

  /**
   * Productos filtrados, agrupados por categoría. Con una categoría específica seleccionada solo
   * hay un grupo (la plantilla oculta el encabezado en ese caso, ya está la píldora activa arriba).
   */
  readonly catalogGroups = computed<IProductCatalogGroup[]>(() => {
    const byCategory = new Map<number, IProductCatalogGroup>();
    for (const p of this.filteredProducts()) {
      const id = p.categoryId ?? 0;
      const group = byCategory.get(id) ?? { categoryId: id, categoryName: p.categoryName ?? 'Sin categoría', products: [] };
      group.products.push(p);
      byCategory.set(id, group);
    }
    return [...byCategory.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  });

  selectCategory(id: number | null): void {
    this.categoryFilter.set(id);
  }

  productImageUrl(product: IProduct): string | null {
    return this.productsService.getImageUrl(product.imagePath);
  }

  // ===== Carrito =====
  addToCart(product: IProduct): void {
    if (!this.selectedWarehouseId) {
      this.notify.warn('Selecciona el almacén de donde sale la venta');
      return;
    }
    const available = this.availableFor(product.id);
    if (available <= 0) {
      this.notify.warn(`Sin existencias de "${product.name}" en este almacén`);
      return;
    }
    const existing = this.cartItems().find((line) => line.productId === product.id);
    if (existing) {
      this.updateQuantity(existing, existing.quantity + 1);
      return;
    }
    this.cartItems.update((lines) => [
      ...lines,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        price: product.price,
        taxRateValue: product.taxRateValue,
        unitAbbreviation: product.unitAbbreviation,
        unitDecimalPlaces: product.unitDecimalPlaces,
        // Con stock fraccionario (ej. 0.5 kg) se agrega lo que haya
        quantity: Math.min(1, available),
        discountPercent: 0
      }
    ]);
  }

  /** `step` del input de cantidad de una línea del carrito: el de la unidad del producto */
  lineStep(line: ICartLine): number {
    return quantityStep(line.unitDecimalPlaces);
  }

  updateQuantity(line: ICartLine, quantity: number): void {
    if (!quantity || quantity <= 0) return;
    const decimalsError = quantityDecimalsError(quantity, line.unitDecimalPlaces, line.productName);
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }
    // Tope: lo que ya tiene la línea + lo que queda libre en el almacén
    const max = line.quantity + this.availableFor(line.productId);
    if (quantity > max) {
      this.notify.warn(`Solo hay ${max} de "${line.productName}" disponibles en este almacén`);
      if (max === line.quantity) return;
      quantity = max;
    }
    this.cartItems.update((lines) =>
      lines.map((l) => (l.productId === line.productId ? { ...l, quantity } : l))
    );
  }

  updateDiscount(line: ICartLine, discountPercent: number): void {
    const clamped = Math.min(Math.max(discountPercent || 0, 0), 100);
    this.cartItems.update((lines) =>
      lines.map((l) => (l.productId === line.productId ? { ...l, discountPercent: clamped } : l))
    );
  }

  removeLine(line: ICartLine): void {
    this.cartItems.update((lines) => lines.filter((l) => l.productId !== line.productId));
  }

  readonly cartComputed = computed<ICartLineComputed[]>(() =>
    this.cartItems().map((line) => {
      const lineGross = round2(line.quantity * line.price);
      const discountAmount = round2(lineGross * (line.discountPercent / 100));
      const lineSubtotal = round2(lineGross - discountAmount);
      const lineTax = round2(lineSubtotal * (line.taxRateValue ?? 0));
      const lineTotal = round2(lineSubtotal + lineTax);
      return { ...line, lineGross, discountAmount, lineSubtotal, lineTax, lineTotal };
    })
  );

  readonly totals = computed(() => {
    const lines = this.cartComputed();
    const subtotal = round2(lines.reduce((s, l) => s + l.lineGross, 0));
    const discountTotal = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.lineTax, 0));
    const total = round2(subtotal - discountTotal + taxTotal);
    return { subtotal, discountTotal, taxTotal, total };
  });

  // ===== Pagos =====
  readonly paidAmount = computed(() => round2(this.paymentLines().reduce((s, p) => s + (p.amount || 0), 0)));
  readonly remaining = computed(() => round2(this.totals().total - this.paidAmount()));

  addPaymentLine(): void {
    const amount = Math.max(this.remaining(), 0);
    this.paymentLines.update((lines) => [
      ...lines,
      { id: this.nextPaymentLineId++, method: 'Cash', amount, receivedCash: null }
    ]);
  }

  removePaymentLine(id: number): void {
    this.paymentLines.update((lines) => lines.filter((line) => line.id !== id));
  }

  updatePaymentMethod(id: number, method: PaymentMethod): void {
    this.paymentLines.update((lines) => lines.map((l) => (l.id === id ? { ...l, method } : l)));
  }

  updatePaymentAmount(id: number, amount: number): void {
    this.paymentLines.update((lines) => lines.map((l) => (l.id === id ? { ...l, amount: amount || 0 } : l)));
  }

  updatePaymentReceived(id: number, receivedCash: number | null): void {
    this.paymentLines.update((lines) => lines.map((l) => (l.id === id ? { ...l, receivedCash } : l)));
  }

  changeFor(line: IPaymentLine): number {
    if (line.method !== 'Cash' || line.receivedCash === null) return 0;
    return round2(Math.max(line.receivedCash - line.amount, 0));
  }

  // ===== Registrar venta =====
  onSubmitSale(): void {
    if (!this.currentSession()) {
      this.notify.warn('No tienes un turno de caja abierto');
      return;
    }
    if (!this.selectedBranchId || !this.selectedWarehouseId) {
      this.notify.warn('Selecciona sucursal y almacén');
      return;
    }
    if (this.cartItems().length === 0) {
      this.notify.warn('Agrega al menos un producto');
      return;
    }
    const stockIssues = this.cartStockIssues();
    if (stockIssues.length > 0) {
      this.notify.warn(`No hay existencias suficientes en este almacén de: ${stockIssues.join(', ')}`);
      return;
    }
    if (this.paidAmount() === 0 && this.totals().total > 0) {
      this.notify.warn('Registra al menos un pago');
      return;
    }
    if (this.remaining() !== 0) {
      this.notify.warn(`Los pagos deben sumar exactamente ${this.totals().total.toFixed(2)}`);
      return;
    }

    const request: ISaleRequest = {
      branchId: this.selectedBranchId,
      warehouseId: this.selectedWarehouseId,
      cashSessionId: this.currentSession()!.id,
      customerId: this.selectedCustomerId,
      items: this.cartItems().map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        discountAmount: round2(line.price * line.quantity * (line.discountPercent / 100))
      })),
      payments: this.paymentLines().map((p) => ({ method: p.method, amount: p.amount }))
    };

    this.saving.set(true);
    this.salesService.create(request).subscribe({
      next: (sale) => {
        this.saving.set(false);
        this.notify.success(`Venta registrada — Folio #${sale.folioNumber}. Total: ${sale.total.toFixed(2)}`);
        this.cartItems.set([]);
        this.paymentLines.set([]);
        this.selectedCustomerId = null;
        this.loadStock();
        if (this.activeTab() === 'history') this.loadHistory();
        this.onViewReceipt(sale);
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Turno =====
  goToCashSessions(): void {
    this.router.navigate(['/caja/turnos']);
  }

  /** El turno se cerró desde el diálogo compartido — vuelve al gate de "sin turno abierto" */
  onSessionClosed(): void {
    this.cartItems.set([]);
    this.loadCurrentSession();
  }

  // ===== Historial =====
  onSelectTab(tab: 'new' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'history' && this.history().length === 0) this.loadHistory();
  }

  onHistoryFilterChange(): void {
    this.historyPage.set(1);
    this.loadHistory();
  }

  onHistoryPageChange(page: number): void {
    this.historyPage.set(page);
    this.loadHistory();
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    const filters: ISaleFilters = {
      ...(this.historyFilterBranchId ? { branchId: this.historyFilterBranchId } : {}),
      ...(this.historyFilterCustomerId ? { customerId: this.historyFilterCustomerId } : {}),
      ...(this.historyFilterFrom ? { from: this.historyFilterFrom } : {}),
      ...(this.historyFilterTo ? { to: this.historyFilterTo } : {}),
      page: this.historyPage(),
      pageSize: this.historyPageSize
    };
    this.salesService.getAll(filters).subscribe({
      next: (result) => {
        this.history.set(result.items);
        this.historyTotalPages.set(result.totalPages);
        this.historyTotalCount.set(result.totalCount);
        this.historyLoading.set(false);
      },
      error: (e) => { this.notify.httpError(e); this.historyLoading.set(false); }
    });
  }

  // ===== Recibo: ver/imprimir y enviar por correo =====
  showReceiptModal = false;
  receiptLoading = signal(false);
  receipt = signal<ISaleReceipt | null>(null);
  receiptEmailInput = '';
  sendingReceipt = signal(false);

  /**
   * Cada sucursal puede tener una impresora distinta — se deja a elegir en vez de adivinar.
   * Las variantes "-auto" para térmica dejan el alto en `auto` (css estándar de impresión
   * continua) en vez de medirlo del ticket renderizado — en el PDF de prueba del navegador se ve
   * con una franja en blanco (Chrome no lo respeta bien en el diálogo interactivo), pero el
   * driver real de una impresora térmica física puede manejarlo distinto (rollo continuo que se
   * corta solo), así que se deja como opción para que prueben en el equipo real, junto con la
   * variante "ajustada al ticket" que sí mide el alto exacto.
   * Las variantes "-full" usan un diseño pensado para llenar la hoja completa (fuente más
   * grande, sin el ancho angosto de ticket térmico) en vez de imprimir el mismo ticket chico
   * centrado en medio de una hoja grande — ver `onPrintReceipt` y `.receipt-ticket.full-page`
   * en styles.scss.
   */
  readonly receiptPaperSizes: { value: string; label: string }[] = [
    { value: '80mm', label: 'Térmica 80mm (ajustada al ticket)' },
    { value: '58mm', label: 'Térmica 58mm (ajustada al ticket)' },
    { value: '80mm-auto', label: 'Térmica 80mm (alto automático)' },
    { value: '58mm-auto', label: 'Térmica 58mm (alto automático)' },
    { value: 'letter', label: 'Carta — ticket angosto en hoja completa' },
    { value: 'a4', label: 'A4 — ticket angosto en hoja completa' },
    { value: 'letter-full', label: 'Carta — formato factura (letra grande)' },
    { value: 'a4-full', label: 'A4 — formato factura (letra grande)' }
  ];
  /** Recordado por navegador (cada caja suele tener siempre la misma impresora conectada) */
  receiptPaperSize: string = this.loadReceiptPaperSize();

  private loadReceiptPaperSize(): string {
    try {
      return localStorage.getItem('pos.receiptPaperSize') ?? '80mm';
    } catch {
      return '80mm';
    }
  }

  onReceiptPaperSizeChange(size: string): void {
    try { localStorage.setItem('pos.receiptPaperSize', size); } catch { /* almacenamiento no disponible, no es crítico */ }
  }

  onViewReceipt(sale: ISale): void {
    this.receipt.set(null);
    this.receiptEmailInput = '';
    this.showReceiptModal = true;
    this.receiptLoading.set(true);
    this.salesService.getReceipt(sale.id).subscribe({
      next: (data) => {
        this.receipt.set(data);
        this.receiptEmailInput = data.customerEmail ?? '';
        this.receiptLoading.set(false);
      },
      error: (e) => { this.receiptLoading.set(false); this.showReceiptModal = false; this.notify.httpError(e); }
    });
  }

  receiptLogoUrl(logoPath: string | null): string | null {
    return this.companiesService.getLogoUrl(logoPath);
  }

  /**
   * El ticket va a una impresora térmica (rollo angosto) en la mayoría de los casos, no a una
   * hoja Carta/A4 — sin esto el navegador imprime en el tamaño de página por defecto, dejando
   * casi toda la hoja en blanco con el ticket chiquito arriba. Un `@page` con nombre vía CSS
   * (`page: print-receipt`) no funciona para esto en Chrome (no cambia el tamaño de papel del
   * diálogo), así que se inyecta/retira por JS justo para esta impresión, según el tamaño que
   * el usuario eligió en `receiptPaperSize` (select junto al botón "Imprimir").
   *
   * Para las térmicas (58mm/80mm) el alto NO se deja en `auto`: se probó `size: 80mm auto;` y
   * Chrome no lo refleja de forma confiable en el diálogo de impresión interactivo — la regla
   * queda como inválida y cae de vuelta al tamaño Carta por defecto (hoja completa con el ticket
   * chiquito arriba, el mismo bug original). En su lugar se mide el alto real del ticket ya
   * renderizado (px) y se convierte a mm, para fijar un `size` con ancho Y alto numéricos.
   *
   * Las opciones "-full" (hoja completa) además agregan la clase `full-page` a `.receipt-ticket`
   * mientras dura la impresión, para que el CSS de `styles.scss` use el diseño de hoja completa
   * en vez del ticket angosto estirado (que se ve raro con líneas cortas en una hoja ancha).
   */
  onPrintReceipt(): void {
    const isFullPage = this.receiptPaperSize.endsWith('-full');
    const isAutoHeight = this.receiptPaperSize.endsWith('-auto');
    const basePaper = isFullPage ? this.receiptPaperSize.replace('-full', '')
      : isAutoHeight ? this.receiptPaperSize.replace('-auto', '')
      : this.receiptPaperSize;

    const ticketEl = document.querySelector<HTMLElement>('.receipt-ticket');
    ticketEl?.classList.toggle('full-page', isFullPage);

    const margin = isFullPage ? '12mm 15mm' : '3mm 4mm';
    let size: string;
    if (basePaper === 'letter') {
      size = 'letter';
    } else if (basePaper === 'a4') {
      size = 'A4';
    } else if (isAutoHeight) {
      size = `${basePaper} auto`;
    } else {
      const heightPx = ticketEl?.getBoundingClientRect().height ?? 600;
      // px → mm (96dpi) + colchón por si el ancho real de impresión difiere un poco del modal
      const heightMm = Math.ceil((heightPx * 25.4) / 96) + 15;
      size = `${basePaper} ${heightMm}mm`;
    }

    const style = document.createElement('style');
    style.textContent = `@page { size: ${size}; margin: ${margin}; }`;
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      ticketEl?.classList.remove('full-page');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  onSendReceipt(): void {
    const receipt = this.receipt();
    if (!receipt) return;
    const email = this.receiptEmailInput.trim();
    if (!email) {
      this.notify.warn('Captura un correo para enviar el recibo');
      return;
    }

    this.sendingReceipt.set(true);
    this.salesService.sendReceipt(receipt.saleId, email).subscribe({
      next: (res) => { this.sendingReceipt.set(false); this.notify.success(res.message); },
      error: (e) => { this.sendingReceipt.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Cancelar venta (puede requerir autorización de un supervisor) =====
  showSupervisorModal = false;
  authorizingCancel = signal(false);
  private cancelingSaleId = 0;
  cancelingSaleFolio = 0;
  supervisorForm = { username: '', password: '' };

  onCancelSale(sale: ISale): void {
    this.confirmService.confirm({
      message: `¿Cancelar la venta #${sale.folioNumber}? Se repondrá el stock y esta acción no se puede deshacer.`,
      header: 'Confirmar cancelación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'No',
      accept: () => this.doCancelSale(sale.id, sale.folioNumber)
    });
  }

  /**
   * Primer intento sin `request`: si el usuario no tiene SALES.CANCEL, el backend responde 403 con
   * `requiresSupervisorApproval` y aquí se abre el modal en vez de mostrar el error genérico. El
   * segundo intento (desde `onSaveSupervisorApproval`) ya manda `request`, así que un error ahí
   * (401 credenciales incorrectas, o 403 porque ese supervisor tampoco tiene permiso) se muestra
   * como toast y el modal se queda abierto para reintentar.
   */
  private doCancelSale(saleId: number, folioNumber: number, request?: ICancelSaleRequest): void {
    this.salesService.cancel(saleId, request).subscribe({
      next: () => {
        this.authorizingCancel.set(false);
        this.showSupervisorModal = false;
        this.notify.success('Venta cancelada');
        this.loadHistory();
      },
      error: (e: HttpErrorResponse) => {
        this.authorizingCancel.set(false);
        const body = e.error as ICancelSaleErrorResponse | undefined;
        if (!request && e.status === 403 && body?.requiresSupervisorApproval) {
          this.cancelingSaleId = saleId;
          this.cancelingSaleFolio = folioNumber;
          this.supervisorForm = { username: '', password: '' };
          this.showSupervisorModal = true;
          return;
        }
        this.notify.httpError(e);
      }
    });
  }

  onSaveSupervisorApproval(): void {
    if (!this.supervisorForm.username || !this.supervisorForm.password) {
      this.notify.warn('Captura usuario y contraseña del supervisor');
      return;
    }
    this.authorizingCancel.set(true);
    this.doCancelSale(this.cancelingSaleId, this.cancelingSaleFolio, {
      supervisorUsername: this.supervisorForm.username,
      supervisorPassword: this.supervisorForm.password
    });
  }
}
