import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ProductionService } from '../../services/production.service';
import { ProductsService } from '../../../products/services/products.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IInventoryItem } from '../../../../core/models/inventory.models';
import { IRecipeItem } from '../../../../core/models/product.models';
import { IProductionOrder } from '../../../../core/models/production.models';
import { quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';

/**
 * Modal "Separar en insumos": descuenta el producto fabricado del almacén y regresa ahí los insumos
 * completos de su receta ACTUAL (no la que tenía cuando se fabricó). El tope es su stock en el almacén.
 * El padre lo crea con `@if` al abrir y lo destruye al cerrar.
 */
@Component({
  selector: 'app-disassemble-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './disassemble-dialog.component.html',
  styleUrl: './disassemble-dialog.component.scss'
})
export class DisassembleDialogComponent implements OnInit {
  private readonly productionService = inject(ProductionService);
  private readonly productsService = inject(ProductsService);
  private readonly notify = inject(NotificationService);

  /** Fila de inventario del producto fabricado en este almacén (da el stock disponible para separar) */
  readonly item = input.required<IInventoryItem>();

  readonly closed = output<void>();
  readonly changed = output<IProductionOrder>();

  recipe = signal<IRecipeItem[]>([]);
  loadingRecipe = signal(true);
  quantity = signal<number | null>(1);
  notes = '';
  saving = signal(false);

  /** `step` del input: el de la unidad del producto */
  readonly step = computed(() => quantityStep(this.item().unitDecimalPlaces));

  /** Insumos que regresan al almacén para la cantidad elegida */
  readonly returning = computed(() => {
    const qty = this.quantity() ?? 0;
    return this.recipe().map((r) => ({ ...r, total: r.quantity * qty }));
  });

  ngOnInit(): void {
    this.productsService.getRecipe(this.item().productId).subscribe({
      next: (items) => { this.recipe.set(items); this.loadingRecipe.set(false); },
      error: (e) => { this.loadingRecipe.set(false); this.notify.httpError(e); }
    });
  }

  onSave(): void {
    const qty = this.quantity();
    const stock = this.item().quantity;
    if (!qty || qty <= 0) {
      this.notify.warn('Ingresa una cantidad mayor a cero');
      return;
    }
    const decimalsError = quantityDecimalsError(qty, this.item().unitDecimalPlaces, this.item().productName);
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }
    if (qty > stock) {
      this.notify.warn(`Solo hay ${stock} en este almacén`);
      return;
    }

    this.saving.set(true);
    this.productionService
      .disassemble({
        productId: this.item().productId,
        warehouseId: this.item().warehouseId,
        quantity: qty,
        notes: this.notes.trim() || null
      })
      .subscribe({
        next: (order) => {
          this.saving.set(false);
          this.notify.success(`${qty} × ${order.productName} separado(s) en insumos — Orden #${order.folioNumber}`);
          this.changed.emit(order);
        },
        error: (e) => { this.saving.set(false); this.notify.httpError(e); }
      });
  }
}
