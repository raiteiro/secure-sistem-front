import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { SalesService } from '../../services/sales.service';
import { ProductsService } from '../../../products/services/products.service';
import { CashSessionsService } from '../../../cash-sessions/services/cash-sessions.service';
import { CashRegistersService } from '../../../cash-registers/services/cash-registers.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { CustomersService } from '../../../customers/services/customers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
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
  quantity: number;
  discountAmount: number;
}

interface ICartLineComputed extends ICartLine {
  lineGross: number;
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

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Efectivo',
  Card: 'Tarjeta',
  Other: 'Otro'
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-sale-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ConfirmDialogModule, HasPermissionDirective, PagerComponent],
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
      next: (data) => this.products.set(data.filter((p) => p.companyId === companyId && p.isActive)),
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
        if (warehouse) this.selectedWarehouseId = warehouse.id;
      },
      error: () => {}
    });
  }

  onBranchChange(): void {
    this.selectedWarehouseId = null;
  }

  readonly availableWarehouses = computed<IWarehouse[]>(() => {
    if (!this.selectedBranchId) return this.warehouses();
    return this.warehouses().filter((w) => w.branchId === this.selectedBranchId || w.branchId === null);
  });

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
        quantity: 1,
        discountAmount: 0
      }
    ]);
  }

  updateQuantity(line: ICartLine, quantity: number): void {
    if (quantity < 1) return;
    this.cartItems.update((lines) =>
      lines.map((l) => (l.productId === line.productId ? { ...l, quantity } : l))
    );
  }

  updateDiscount(line: ICartLine, discountAmount: number): void {
    const maxDiscount = round2(line.price * line.quantity);
    const clamped = Math.min(Math.max(discountAmount || 0, 0), maxDiscount);
    this.cartItems.update((lines) =>
      lines.map((l) => (l.productId === line.productId ? { ...l, discountAmount: clamped } : l))
    );
  }

  removeLine(line: ICartLine): void {
    this.cartItems.update((lines) => lines.filter((l) => l.productId !== line.productId));
  }

  readonly cartComputed = computed<ICartLineComputed[]>(() =>
    this.cartItems().map((line) => {
      const lineGross = round2(line.quantity * line.price);
      const lineSubtotal = round2(lineGross - line.discountAmount);
      const lineTax = round2(lineSubtotal * (line.taxRateValue ?? 0));
      const lineTotal = round2(lineSubtotal + lineTax);
      return { ...line, lineGross, lineSubtotal, lineTax, lineTotal };
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
        discountAmount: line.discountAmount
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
        if (this.activeTab() === 'history') this.loadHistory();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Turno =====
  goToCashSessions(): void {
    this.router.navigate(['/caja/turnos']);
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

  onPrintReceipt(): void {
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
