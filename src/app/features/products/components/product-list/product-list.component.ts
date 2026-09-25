import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ProductsService } from '../../services/products.service';
import { CategoriesService } from '../../../categories/services/categories.service';
import { TaxRatesService } from '../../../tax-rates/services/tax-rates.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CommissionType,
  IAssignComboItemsRequest,
  IComboItem,
  IProduct,
  IProductRequest
} from '../../../../core/models/product.models';
import { ICategory } from '../../../../core/models/category.models';
import { ITaxRate } from '../../../../core/models/tax-rate.models';
import { ICompany } from '../../../../core/models/company.models';
import { ISupplier } from '../../../../core/models/supplier.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IProductForm {
  sku: string;
  name: string;
  description: string;
  unit: string;
  price: number | null;
  cost: number | null;
  categoryId: number | null;
  taxRateId: number | null;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
  isCombo: boolean;
  supplierId: number | null;
  commissionType: CommissionType;
  commissionValue: number | null;
}

const EMPTY_FORM: IProductForm = {
  sku: '',
  name: '',
  description: '',
  unit: '',
  price: null,
  cost: null,
  categoryId: null,
  taxRateId: null,
  companyId: null,
  isCombo: false,
  supplierId: null,
  commissionType: 'Percentage',
  commissionValue: null
};

interface IProductGroup {
  companyId: number;
  companyName: string;
  products: IProduct[];
}

interface IComboItemForm {
  componentProductId: number;
  componentProductName: string;
  componentProductSku: string | null;
  quantity: number;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss'
})
export class ProductListComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly taxRatesService = inject(TaxRatesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  products = signal<IProduct[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  allCategories = signal<ICategory[]>([]);
  allTaxRates = signal<ITaxRate[]>([]);
  allSuppliers = signal<ISupplier[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  /** Empresa del producto que se está editando (para filtrar los selects de categoría/impuesto) */
  editCompanyId: number | null = null;
  form: IProductForm = { ...EMPTY_FORM };

  // Imagen (solo disponible editando, requiere un id existente)
  uploadingImage = signal(false);
  imageUrl = signal<string | null>(null);

  // ===== Combo/kit: componentes =====
  showComboModal = false;
  savingCombo = signal(false);
  comboProductId = 0;
  comboProductName = '';
  comboProductCompanyId = 0;
  comboItems = signal<IComboItemForm[]>([]);
  comboAddProductId: number | null = null;
  comboAddQuantity: number | null = 1;

  ngOnInit(): void {
    this.loadProducts();
    this.categoriesService.getAll().subscribe({
      next: (data) => this.allCategories.set(data),
      error: () => this.notify.error('No se pudieron cargar las categorías')
    });
    this.taxRatesService.getAll().subscribe({
      next: (data) => this.allTaxRates.set(data),
      error: () => this.notify.error('No se pudieron cargar los impuestos')
    });
    this.suppliersService.getAll().subscribe({
      next: (data) => this.allSuppliers.set(data),
      error: () => this.notify.error('No se pudieron cargar los proveedores')
    });

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadProducts(): void {
    this.loading.set(true);
    this.productsService.getAll().subscribe({
      next: (data) => { this.products.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los productos'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  imageThumbUrl(product: IProduct): string | null {
    return this.productsService.getImageUrl(product.imagePath);
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly productGroups = computed<IProductGroup[]>(() => {
    const products = this.products();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', products }];
    }

    const byCompany = new Map<number, IProduct[]>();
    for (const product of products) {
      const companyId = product.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(product);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        products: list
      }));
  });

  private targetCompanyId(): number | null {
    return this.isEdit()
      ? this.editCompanyId
      : (this.form.companyId ?? this.authService.currentUser()?.companyId ?? null);
  }

  /**
   * Métodos normales, NO `computed()`: dependen de `form.companyId`/`form.supplierId`, propiedades
   * planas del objeto `form` (no signals). Un `computed()` solo se re-evalúa cuando cambia un signal
   * del que depende — como estas propiedades no lo son, quedaba "congelado" en el valor de la
   * primera lectura y nunca reflejaba lo que el usuario iba eligiendo en el formulario.
   */
  availableCategories(): ICategory[] {
    const target = this.targetCompanyId();
    if (!target) return this.allCategories();
    return this.allCategories().filter((c) => c.companyId === target);
  }

  availableTaxRates(): ITaxRate[] {
    const target = this.targetCompanyId();
    if (!target) return this.allTaxRates();
    return this.allTaxRates().filter((t) => t.companyId === target);
  }

  availableSuppliers(): ISupplier[] {
    const target = this.targetCompanyId();
    const active = this.allSuppliers().filter((s) => s.isActive);
    if (!target) return active;
    return active.filter((s) => s.companyId === target);
  }

  /** Si el proveedor elegido es consignador, hay que capturar tipo/valor de comisión */
  selectedSupplierIsConsignor(): boolean {
    if (!this.form.supplierId) return false;
    return this.availableSuppliers().find((s) => s.id === this.form.supplierId)?.isConsignor ?? false;
  }

  onCompanyChange(): void {
    this.form.categoryId = null;
    this.form.taxRateId = null;
    this.form.supplierId = null;
  }

  onSupplierChange(): void {
    this.form.commissionType = 'Percentage';
    this.form.commissionValue = null;
  }

  /**
   * Mismo cálculo que hace el backend para productos de un proveedor consignador (el `cost` que se
   * mande en el body se ignora y se sobrescribe con esto) — se muestra de solo lectura en el form
   * para que no parezca editable, y es lo que realmente se manda al guardar.
   */
  resolvedCost(): number | null {
    if (!this.selectedSupplierIsConsignor()) return this.form.cost;
    if (this.form.commissionValue === null) return null;
    if (this.form.commissionType === 'FixedAmount') return this.form.commissionValue;
    if (this.form.price === null) return null;
    return Math.round(this.form.price * (1 - this.form.commissionValue / 100) * 100) / 100;
  }

  /** Candidatos a componente: activos, de la misma empresa, ni el combo mismo ni otro combo (no hay combos anidados), ni ya agregados */
  readonly availableComboComponents = computed<IProduct[]>(() => {
    const usedIds = new Set(this.comboItems().map((i) => i.componentProductId));
    return this.products().filter((p) =>
      p.isActive &&
      p.companyId === this.comboProductCompanyId &&
      p.id !== this.comboProductId &&
      !p.isCombo &&
      !usedIds.has(p.id)
    );
  });

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.isEdit.set(false);
    this.editId = 0;
    this.editCompanyId = null;
    this.imageUrl.set(null);
    this.showModal = true;
  }

  onEdit(product: IProduct): void {
    this.isEdit.set(true);
    this.editId = product.id;
    this.editCompanyId = product.companyId;
    this.form = {
      sku: product.sku ?? '',
      name: product.name,
      description: product.description ?? '',
      unit: product.unit ?? '',
      price: product.price,
      cost: product.cost,
      categoryId: product.categoryId,
      taxRateId: product.taxRateId,
      companyId: null,
      isCombo: product.isCombo,
      supplierId: product.supplierId,
      commissionType: product.commissionType ?? 'Percentage',
      commissionValue: product.commissionValue
    };
    this.imageUrl.set(this.productsService.getImageUrl(product.imagePath));
    this.showModal = true;
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo si se cancela/reintenta
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.notify.warn('La imagen debe ser PNG, JPEG, WEBP o GIF');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.notify.warn('La imagen no puede pesar más de 2 MB');
      return;
    }

    this.uploadingImage.set(true);
    this.productsService.uploadImage(this.editId, file).subscribe({
      next: (response) => {
        this.uploadingImage.set(false);
        this.imageUrl.set(this.productsService.getImageUrl(response.imagePath));
        this.notify.success('Imagen actualizada');
        this.loadProducts();
      },
      error: (e) => { this.uploadingImage.set(false); this.notify.httpError(e); }
    });
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }
    if (this.form.price === null || this.form.price < 0) {
      this.notify.warn('Ingresa un precio válido');
      return;
    }
    const isConsignor = this.selectedSupplierIsConsignor();
    if (!isConsignor && this.form.cost !== null && this.form.cost < 0) {
      this.notify.warn('El costo no puede ser negativo');
      return;
    }
    if (isConsignor && (this.form.commissionValue === null || this.form.commissionValue < 0)) {
      this.notify.warn('El proveedor es consignador: ingresa el valor de la comisión');
      return;
    }

    const request: IProductRequest = {
      sku: this.form.sku || null,
      name: this.form.name,
      description: this.form.description || null,
      unit: this.form.unit || null,
      price: this.form.price,
      cost: this.resolvedCost(),
      categoryId: this.form.categoryId,
      taxRateId: this.form.taxRateId,
      isCombo: this.form.isCombo,
      supplierId: this.form.supplierId,
      commissionType: isConsignor ? this.form.commissionType : null,
      commissionValue: isConsignor ? this.form.commissionValue : null,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.productsService.update(this.editId, request)
      : this.productsService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Producto actualizado' : 'Producto creado');
        this.loadProducts();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(product: IProduct): void {
    this.confirmService.confirm({
      message: `¿Desactivar el producto "${product.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.productsService.deactivate(product.id).subscribe({
          next: () => { this.notify.success('Producto desactivado'); this.loadProducts(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }

  // ===== Combo/kit: componentes =====
  onManageComboItems(product: IProduct): void {
    this.comboProductId = product.id;
    this.comboProductName = product.name;
    this.comboProductCompanyId = product.companyId;
    this.comboAddProductId = null;
    this.comboAddQuantity = 1;

    this.productsService.getComboItems(product.id).subscribe({
      next: (items: IComboItem[]) => {
        this.comboItems.set(items.map((i) => ({
          componentProductId: i.componentProductId,
          componentProductName: i.componentProductName,
          componentProductSku: i.componentProductSku,
          quantity: i.quantity
        })));
        this.showComboModal = true;
      },
      error: (e) => this.notify.httpError(e)
    });
  }

  onAddComboItem(): void {
    if (!this.comboAddProductId) {
      this.notify.warn('Selecciona un producto');
      return;
    }
    if (!this.comboAddQuantity || this.comboAddQuantity <= 0) {
      this.notify.warn('Ingresa una cantidad mayor a cero');
      return;
    }

    const component = this.products().find((p) => p.id === this.comboAddProductId);
    if (!component) return;

    this.comboItems.update((items) => [
      ...items,
      {
        componentProductId: component.id,
        componentProductName: component.name,
        componentProductSku: component.sku,
        quantity: this.comboAddQuantity!
      }
    ]);
    this.comboAddProductId = null;
    this.comboAddQuantity = 1;
  }

  onRemoveComboItem(componentProductId: number): void {
    this.comboItems.update((items) => items.filter((i) => i.componentProductId !== componentProductId));
  }

  onSaveComboItems(): void {
    if (this.comboItems().length === 0) {
      this.notify.warn('Agrega al menos un componente');
      return;
    }

    const request: IAssignComboItemsRequest = {
      items: this.comboItems().map((i) => ({ componentProductId: i.componentProductId, quantity: i.quantity }))
    };

    this.savingCombo.set(true);
    this.productsService.assignComboItems(this.comboProductId, request).subscribe({
      next: () => {
        this.savingCombo.set(false);
        this.showComboModal = false;
        this.notify.success('Componentes del combo actualizados');
      },
      error: (e) => { this.savingCombo.set(false); this.notify.httpError(e); }
    });
  }
}
