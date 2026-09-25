import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { ConsignmentService } from '../../services/consignment.service';
import { ProductsService } from '../../../products/services/products.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  IConsignmentBalance,
  IConsignmentSale,
  IConsignmentSettlement
} from '../../../../core/models/consignment.models';
import { ICompany } from '../../../../core/models/company.models';

type ConsignmentTab = 'balances' | 'settlements' | 'stock';

interface IConsignedProductRow {
  productId: number;
  productName: string;
  productSku: string | null;
  warehouseName: string;
  quantity: number;
}

interface IConsignedSupplierGroup {
  supplierId: number;
  supplierName: string;
  rows: IConsignedProductRow[];
}

interface IConsignedCompanyGroup {
  companyId: number;
  companyName: string;
  suppliers: IConsignedSupplierGroup[];
}

@Component({
  selector: 'app-consignment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, HasPermissionDirective, PagerComponent],
  templateUrl: './consignment-list.component.html',
  styleUrl: './consignment-list.component.scss'
})
export class ConsignmentListComponent implements OnInit {
  private readonly consignmentService = inject(ConsignmentService);
  private readonly productsService = inject(ProductsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  activeTab = signal<ConsignmentTab>('balances');

  balances = signal<IConsignmentBalance[]>([]);
  balancesLoading = signal(true);

  settlements = signal<IConsignmentSettlement[]>([]);
  settlementsLoading = signal(false);
  private settlementsLoaded = false;
  settlementsFilterFrom = '';
  settlementsFilterTo = '';
  readonly settlementsPageSize = 25;
  settlementsPage = signal(1);
  settlementsTotalPages = signal(1);
  settlementsTotalCount = signal(0);

  stockGroups = signal<IConsignedCompanyGroup[]>([]);
  stockLoading = signal(false);
  private stockLoaded = false;
  private companies: ICompany[] = [];

  ngOnInit(): void {
    this.loadBalances();
  }

  onSelectTab(tab: ConsignmentTab): void {
    this.activeTab.set(tab);
    if (tab === 'settlements' && !this.settlementsLoaded) this.loadSettlements();
    if (tab === 'stock' && !this.stockLoaded) this.loadConsignedStock();
  }

  loadBalances(): void {
    this.balancesLoading.set(true);
    this.consignmentService.getBalances().subscribe({
      next: (data) => { this.balances.set(data); this.balancesLoading.set(false); },
      error: (e) => { this.notify.httpError(e); this.balancesLoading.set(false); }
    });
  }

  loadSettlements(): void {
    this.settlementsLoading.set(true);
    const filters = {
      ...(this.settlementsFilterFrom ? { from: this.settlementsFilterFrom } : {}),
      ...(this.settlementsFilterTo ? { to: this.settlementsFilterTo } : {}),
      page: this.settlementsPage(),
      pageSize: this.settlementsPageSize
    };
    this.consignmentService.getSettlements(filters).subscribe({
      next: (result) => {
        this.settlements.set(result.items);
        this.settlementsTotalPages.set(result.totalPages);
        this.settlementsTotalCount.set(result.totalCount);
        this.settlementsLoading.set(false);
        this.settlementsLoaded = true;
      },
      error: (e) => { this.notify.httpError(e); this.settlementsLoading.set(false); }
    });
  }

  onSettlementsFilterChange(): void {
    this.settlementsPage.set(1);
    this.loadSettlements();
  }

  onSettlementsPageChange(page: number): void {
    this.settlementsPage.set(page);
    this.loadSettlements();
  }

  // ===== Modal: detalle de ventas (saldo pendiente de un proveedor, o cubiertas por una liquidación) =====
  showDetailModal = false;
  detailLoading = signal(false);
  detailSupplierName = '';
  detailSettlement = signal<IConsignmentSettlement | null>(null);
  detailSales = signal<IConsignmentSale[]>([]);
  /** Solo aplica a "ventas pendientes" — el detalle de una liquidación ya cerrada no se pagina */
  detailSupplierId: number | null = null;
  readonly detailPageSize = 25;
  detailPage = signal(1);
  detailTotalPages = signal(1);
  detailTotalCount = signal(0);

  onViewPendingSales(balance: IConsignmentBalance): void {
    this.detailSettlement.set(null);
    this.detailSupplierName = balance.supplierName;
    this.detailSupplierId = balance.supplierId;
    this.detailPage.set(1);
    this.showDetailModal = true;
    this.loadPendingSalesDetail();
  }

  private loadPendingSalesDetail(): void {
    if (this.detailSupplierId === null) return;
    this.detailLoading.set(true);
    this.consignmentService.getSales({
      supplierId: this.detailSupplierId,
      pending: true,
      page: this.detailPage(),
      pageSize: this.detailPageSize
    }).subscribe({
      next: (result) => {
        this.detailSales.set(result.items);
        this.detailTotalPages.set(result.totalPages);
        this.detailTotalCount.set(result.totalCount);
        this.detailLoading.set(false);
      },
      error: (e) => { this.detailLoading.set(false); this.notify.httpError(e); }
    });
  }

  onDetailPageChange(page: number): void {
    this.detailPage.set(page);
    this.loadPendingSalesDetail();
  }

  onViewSettlementDetail(settlement: IConsignmentSettlement): void {
    this.detailSettlement.set(settlement);
    this.detailSupplierName = settlement.supplierName;
    this.detailSupplierId = null;
    this.showDetailModal = true;
    this.detailLoading.set(true);
    this.consignmentService.getSettlementById(settlement.id).subscribe({
      next: (data) => { this.detailSales.set(data.sales); this.detailLoading.set(false); },
      error: (e) => { this.detailLoading.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Modal: liquidar =====
  showSettleModal = false;
  settling = signal(false);
  settlingSupplierId = 0;
  settlingSupplierName = '';
  settlingPendingAmount = 0;
  settleNotes = '';

  onOpenSettle(balance: IConsignmentBalance): void {
    this.settlingSupplierId = balance.supplierId;
    this.settlingSupplierName = balance.supplierName;
    this.settlingPendingAmount = balance.pendingAmount;
    this.settleNotes = '';
    this.showSettleModal = true;
  }

  onConfirmSettle(): void {
    this.settling.set(true);
    this.consignmentService.createSettlement({
      supplierId: this.settlingSupplierId,
      notes: this.settleNotes || null
    }).subscribe({
      next: () => {
        this.settling.set(false);
        this.showSettleModal = false;
        this.notify.success(`Liquidación registrada para "${this.settlingSupplierName}"`);
        this.loadBalances();
        this.settlementsLoaded = false;
        this.settlementsPage.set(1);
        if (this.activeTab() === 'settlements') this.loadSettlements();
      },
      error: (e) => { this.settling.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Productos por consignador (armado en frontend: Suppliers + Products + Inventory) =====
  private companyName(companyId: number): string {
    return this.companies.find((c) => c.id === companyId)?.name ?? `Empresa #${companyId}`;
  }

  loadConsignedStock(): void {
    this.stockLoading.set(true);

    const companies$ = this.authService.isSystemAdmin() ? this.companiesService.getAll() : null;

    forkJoin({
      suppliers: this.suppliersService.getAll(),
      products: this.productsService.getAll(),
      inventory: this.inventoryService.getAll(),
      companies: companies$ ?? forkJoin([])
    }).subscribe({
      next: ({ suppliers, products, inventory, companies }) => {
        this.companies = companies as ICompany[];

        // companyId -> supplierId -> grupo. Se siembra con TODOS los consignadores activos,
        // aunque no tengan productos todavía, para que no "desaparezcan" de la vista.
        const byCompany = new Map<number, Map<number, IConsignedSupplierGroup>>();
        const ensureSupplierGroup = (companyId: number, supplierId: number, supplierName: string): IConsignedSupplierGroup => {
          const supplierMap = byCompany.get(companyId) ?? new Map<number, IConsignedSupplierGroup>();
          byCompany.set(companyId, supplierMap);
          const existing = supplierMap.get(supplierId);
          if (existing) return existing;
          const created: IConsignedSupplierGroup = { supplierId, supplierName, rows: [] };
          supplierMap.set(supplierId, created);
          return created;
        };

        for (const supplier of suppliers) {
          if (supplier.isConsignor && supplier.isActive) {
            ensureSupplierGroup(supplier.companyId, supplier.id, supplier.name);
          }
        }

        const inventoryByProductId = new Map<number, typeof inventory>();
        for (const item of inventory) {
          const list = inventoryByProductId.get(item.productId) ?? [];
          list.push(item);
          inventoryByProductId.set(item.productId, list);
        }

        for (const product of products) {
          if (!product.supplierIsConsignor || !product.supplierId) continue;
          const group = ensureSupplierGroup(product.companyId, product.supplierId, product.supplierName ?? `Proveedor #${product.supplierId}`);
          const stockItems = inventoryByProductId.get(product.id) ?? [];

          if (stockItems.length === 0) {
            group.rows.push({ productId: product.id, productName: product.name, productSku: product.sku, warehouseName: '—', quantity: 0 });
          } else {
            for (const item of stockItems) {
              group.rows.push({
                productId: product.id,
                productName: product.name,
                productSku: product.sku,
                warehouseName: item.warehouseName,
                quantity: item.quantity
              });
            }
          }
        }

        this.stockGroups.set(
          [...byCompany.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([companyId, supplierMap]) => ({
              companyId,
              companyName: this.companyName(companyId),
              suppliers: [...supplierMap.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName))
            }))
        );
        this.stockLoading.set(false);
        this.stockLoaded = true;
      },
      error: (e) => { this.notify.httpError(e); this.stockLoading.set(false); }
    });
  }
}
