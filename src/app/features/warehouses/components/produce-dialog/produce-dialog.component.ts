import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { RecipeEditorComponent, IRecipeLine } from '../recipe-editor/recipe-editor.component';
import { ProductionService } from '../../services/production.service';
import { ProductsService } from '../../../products/services/products.service';
import { CategoriesService } from '../../../categories/services/categories.service';
import { TaxRatesService } from '../../../tax-rates/services/tax-rates.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { UnitsOfMeasureService } from '../../../units-of-measure/services/units-of-measure.service';
import { IUnitOfMeasure } from '../../../../core/models/unit-of-measure.models';
import { quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';
import { IProduct, IRecipeItem } from '../../../../core/models/product.models';
import { ICategory } from '../../../../core/models/category.models';
import { ITaxRate } from '../../../../core/models/tax-rate.models';
import { IProductionAvailability, IProductionOrder } from '../../../../core/models/production.models';

type ProduceMode = 'existing' | 'new';

interface INewProductForm {
  name: string;
  sku: string;
  unitId: number | null;
  price: number | null;
  categoryId: number | null;
  taxRateId: number | null;
}

/** Vista previa por insumo: lo que se va a consumir y con cuánto queda el almacén */
interface ISupplyConsumption {
  supplyProductId: number;
  supplyProductName: string;
  supplyUnit: string | null;
  quantityPerUnit: number;
  stock: number;
  needed: number;
  remaining: number;
  isActive: boolean;
  isLimiting: boolean;
}

const EMPTY_NEW_FORM: INewProductForm = { name: '', sku: '', unitId: null, price: null, categoryId: null, taxRateId: null };

function toRecipeLines(items: IRecipeItem[]): IRecipeLine[] {
  return items.map((i) => ({
    supplyProductId: i.supplyProductId,
    supplyProductName: i.supplyProductName,
    supplyUnit: i.supplyUnit,
    supplyUnitDecimalPlaces: i.supplyUnitDecimalPlaces,
    quantity: i.quantity
  }));
}

/**
 * Modal "Crear producto" del detalle de almacén: fabrica un producto con los insumos del almacén.
 * Dos modos — un fabricado ya dado de alta (con cuántos se pueden hacer y qué insumo limita, y la
 * opción de editar su receta) o uno nuevo (datos + receta, y opcionalmente fabricar en el acto).
 * El padre lo crea con `@if` al abrir y lo destruye al cerrar, así cada apertura arranca limpia.
 */
@Component({
  selector: 'app-produce-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, HasPermissionDirective, RecipeEditorComponent],
  templateUrl: './produce-dialog.component.html',
  styleUrl: './produce-dialog.component.scss'
})
export class ProduceDialogComponent implements OnInit {
  private readonly productionService = inject(ProductionService);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly taxRatesService = inject(TaxRatesService);
  private readonly unitsService = inject(UnitsOfMeasureService);
  private readonly notify = inject(NotificationService);

  /** Almacén donde se consumen los insumos y entra el producto */
  readonly warehouseId = input.required<number>();

  /** Empresa del almacén: acota categorías/impuestos y es donde se da de alta un fabricado nuevo */
  readonly companyId = input.required<number>();

  /** Insumos activos de la empresa, para armar recetas */
  readonly supplies = input.required<IProduct[]>();

  /** Stock de cada insumo en este almacén, por productId */
  readonly supplyStock = input<Record<number, number>>({});

  /** Se cerró el modal sin cambios pendientes de refrescar */
  readonly closed = output<void>();

  /** Hubo cambios de stock o de catálogo (fabricación, alta o receta): el padre debe recargar */
  readonly changed = output<IProductionOrder | null>();

  mode = signal<ProduceMode>('existing');
  saving = signal(false);

  // ===== Fabricado existente =====
  availability = signal<IProductionAvailability[]>([]);
  loadingAvailability = signal(true);
  selectedProductId = signal<number | null>(null);
  quantity = signal<number | null>(1);
  notes = '';

  editingRecipe = signal(false);
  loadingRecipe = signal(false);
  recipeDraft = signal<IRecipeLine[]>([]);

  // ===== Producto nuevo =====
  newForm: INewProductForm = { ...EMPTY_NEW_FORM };
  newRecipe = signal<IRecipeLine[]>([]);
  /** Cuántos fabricar en el acto después de darlo de alta (0 = solo darlo de alta) */
  newQuantity = signal<number | null>(0);
  categories = signal<ICategory[]>([]);
  taxRates = signal<ITaxRate[]>([]);
  units = signal<IUnitOfMeasure[]>([]);

  /** Al cerrar sin haber cambiado nada se emite `closed`; si hubo cambios, `changed` */
  private hasChanges = false;

  ngOnInit(): void {
    this.loadAvailability();
    this.categoriesService.getAll().subscribe({
      next: (data) => this.categories.set(data.filter((c) => c.companyId === this.companyId() && c.isActive)),
      error: () => {}
    });
    this.unitsService.getAll().subscribe({
      next: (data) => this.units.set(data),
      error: () => {}
    });
    this.taxRatesService.getAll().subscribe({
      next: (data) => this.taxRates.set(data.filter((t) => t.companyId === this.companyId() && t.isActive)),
      error: () => {}
    });
  }

  private loadAvailability(selectProductId?: number): void {
    this.loadingAvailability.set(true);
    this.productionService.getAvailability({ warehouseId: this.warehouseId() }).subscribe({
      next: (data) => {
        this.availability.set(data);
        this.loadingAvailability.set(false);
        if (selectProductId) this.selectedProductId.set(selectProductId);
      },
      error: (e) => { this.loadingAvailability.set(false); this.notify.httpError(e); }
    });
  }

  readonly selected = computed<IProductionAvailability | null>(
    () => this.availability().find((a) => a.productId === this.selectedProductId()) ?? null
  );

  /** Consumo de insumos para la cantidad elegida, del fabricado existente seleccionado */
  readonly existingConsumption = computed<ISupplyConsumption[]>(() => {
    const selected = this.selected();
    const qty = this.quantity() ?? 0;
    if (!selected) return [];
    return selected.supplies.map((s) => ({
      supplyProductId: s.supplyProductId,
      supplyProductName: s.supplyProductName,
      supplyUnit: s.supplyUnit,
      quantityPerUnit: s.quantityPerUnit,
      stock: s.stock,
      needed: s.quantityPerUnit * qty,
      remaining: s.stock - s.quantityPerUnit * qty,
      isActive: s.isActive,
      isLimiting: s.isLimiting
    }));
  });

  /** Cuántos se pueden fabricar con la receta nueva y el stock del almacén (misma regla que el backend) */
  readonly newMaxProducible = computed<number>(() => {
    const lines = this.newRecipe().filter((l) => l.quantity > 0);
    if (lines.length === 0) return 0;
    return Math.min(...lines.map((l) => Math.floor(Math.max(this.stockOf(l.supplyProductId), 0) / l.quantity)));
  });

  /** Consumo de insumos de la receta nueva para `newQuantity` */
  readonly newConsumption = computed<ISupplyConsumption[]>(() => {
    const qty = this.newQuantity() ?? 0;
    const max = this.newMaxProducible();
    return this.newRecipe().map((l) => {
      const stock = this.stockOf(l.supplyProductId);
      const possible = l.quantity > 0 ? Math.floor(Math.max(stock, 0) / l.quantity) : 0;
      return {
        supplyProductId: l.supplyProductId,
        supplyProductName: l.supplyProductName,
        supplyUnit: l.supplyUnit,
        quantityPerUnit: l.quantity,
        stock,
        needed: l.quantity * qty,
        remaining: stock - l.quantity * qty,
        isActive: true,
        isLimiting: possible === max
      };
    });
  });

  /** Unidad elegida para el producto nuevo */
  private newUnit(): IUnitOfMeasure | undefined {
    return this.units().find((u) => u.id === this.newForm.unitId);
  }

  /** `step` del input de cantidad a fabricar: el de la unidad del producto */
  existingStep(): number {
    return quantityStep(this.selected()?.productUnitDecimalPlaces);
  }

  newStep(): number {
    return quantityStep(this.newUnit()?.decimalPlaces);
  }

  stockOf(supplyProductId: number): number {
    return this.supplyStock()[supplyProductId] ?? 0;
  }

  onSelectMode(mode: ProduceMode): void {
    this.mode.set(mode);
    this.editingRecipe.set(false);
  }

  onSelectProduct(productId: number | null): void {
    this.selectedProductId.set(productId);
    this.editingRecipe.set(false);
    this.quantity.set(1);
  }

  onClose(): void {
    if (this.hasChanges) this.changed.emit(null);
    else this.closed.emit();
  }

  // ===== Fabricar un existente =====
  onProduceExisting(): void {
    const selected = this.selected();
    const qty = this.quantity();
    if (!selected) {
      this.notify.warn('Selecciona el producto a fabricar');
      return;
    }
    if (!qty || qty <= 0) {
      this.notify.warn('Ingresa una cantidad mayor a cero');
      return;
    }
    const decimalsError = quantityDecimalsError(qty, selected.productUnitDecimalPlaces, selected.productName);
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }
    if (qty > selected.maxProducible) {
      this.notify.warn(`Con el stock actual se pueden fabricar como máximo ${selected.maxProducible}`);
      return;
    }
    this.produce(selected.productId, qty, `${qty} × ${selected.productName} fabricado(s)`);
  }

  private produce(productId: number, qty: number, successMessage: string): void {
    this.saving.set(true);
    this.productionService
      .produce({ productId, warehouseId: this.warehouseId(), quantity: qty, notes: this.notes.trim() || null })
      .subscribe({
        next: (order) => {
          this.saving.set(false);
          this.notify.success(`${successMessage} — Orden #${order.folioNumber}`);
          this.changed.emit(order);
        },
        error: (e) => {
          this.saving.set(false);
          this.notify.httpError(e);
          if (this.mode() === 'new') {
            // El alta sí se hizo, solo falló fabricar: se sigue desde "Fabricado existente"
            this.newForm = { ...EMPTY_NEW_FORM };
            this.newRecipe.set([]);
            this.mode.set('existing');
          }
          // El stock pudo cambiar desde que se abrió el modal: refresca el máximo
          this.loadAvailability(productId);
        }
      });
  }

  // ===== Editar receta de un existente =====
  onEditRecipe(): void {
    const productId = this.selectedProductId();
    if (!productId) return;
    this.loadingRecipe.set(true);
    this.productsService.getRecipe(productId).subscribe({
      next: (items) => {
        this.recipeDraft.set(toRecipeLines(items));
        this.loadingRecipe.set(false);
        this.editingRecipe.set(true);
      },
      error: (e) => { this.loadingRecipe.set(false); this.notify.httpError(e); }
    });
  }

  onSaveRecipe(): void {
    const productId = this.selectedProductId();
    if (!productId || !this.isRecipeValid(this.recipeDraft())) return;
    this.saving.set(true);
    this.productsService.assignRecipe(productId, { items: this.toRecipeRequest(this.recipeDraft()) }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingRecipe.set(false);
        this.hasChanges = true;
        this.notify.success('Receta actualizada');
        this.loadAvailability(productId);
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  // ===== Producto nuevo =====
  onCreateNew(): void {
    if (!this.newForm.name.trim()) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }
    const unit = this.newUnit();
    if (!unit) {
      this.notify.warn('Selecciona la unidad de medida');
      return;
    }
    if (this.newForm.price === null || this.newForm.price < 0) {
      this.notify.warn('Ingresa un precio de venta válido');
      return;
    }
    if (!this.isRecipeValid(this.newRecipe())) return;
    const qty = this.newQuantity() ?? 0;
    if (qty < 0) {
      this.notify.warn('La cantidad a fabricar no puede ser negativa');
      return;
    }
    const qtyDecimalsError = quantityDecimalsError(qty, unit.decimalPlaces, this.newForm.name.trim(), unit.name);
    if (qtyDecimalsError) {
      this.notify.warn(qtyDecimalsError);
      return;
    }
    if (qty > this.newMaxProducible()) {
      this.notify.warn(`Con el stock actual se pueden fabricar como máximo ${this.newMaxProducible()}`);
      return;
    }

    this.saving.set(true);
    this.productsService
      .createManufactured({
        name: this.newForm.name.trim(),
        sku: this.newForm.sku.trim() || null,
        unitId: unit.id,
        price: this.newForm.price,
        categoryId: this.newForm.categoryId,
        taxRateId: this.newForm.taxRateId,
        companyId: this.companyId(),
        recipe: this.toRecipeRequest(this.newRecipe())
      })
      .subscribe({
        next: (product) => {
          this.hasChanges = true;
          if (qty > 0) {
            this.produce(product.id, qty, `"${product.name}" dado de alta y ${qty} fabricado(s)`);
            return;
          }
          this.saving.set(false);
          this.notify.success(`"${product.name}" dado de alta`);
          // Queda listo para fabricar desde "Fabricado existente"
          this.newForm = { ...EMPTY_NEW_FORM };
          this.newRecipe.set([]);
          this.mode.set('existing');
          this.loadAvailability(product.id);
        },
        error: (e) => { this.saving.set(false); this.notify.httpError(e); }
      });
  }

  private isRecipeValid(lines: IRecipeLine[]): boolean {
    if (lines.length === 0) {
      this.notify.warn('La receta debe tener al menos un insumo');
      return false;
    }
    if (lines.some((l) => !l.quantity || l.quantity <= 0)) {
      this.notify.warn('La cantidad de cada insumo debe ser mayor a 0');
      return false;
    }
    for (const line of lines) {
      const error = quantityDecimalsError(line.quantity, line.supplyUnitDecimalPlaces, line.supplyProductName);
      if (error) {
        this.notify.warn(error);
        return false;
      }
    }
    return true;
  }

  private toRecipeRequest(lines: IRecipeLine[]): { supplyProductId: number; quantity: number }[] {
    return lines.map((l) => ({ supplyProductId: l.supplyProductId, quantity: l.quantity }));
  }
}
