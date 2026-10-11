import { Component, computed, inject, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IProduct } from '../../../../core/models/product.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { quantityDecimalsError, quantityStep } from '../../../../core/utils/quantity.util';

/** Una línea de receta en edición: cuánto insumo lleva 1 unidad del producto fabricado */
export interface IRecipeLine {
  supplyProductId: number;
  supplyProductName: string;
  supplyUnit: string | null;
  /** Decimales que admite la unidad del insumo (0.5 kg sí, 0.5 huevos no) */
  supplyUnitDecimalPlaces: number;
  quantity: number;
}

/**
 * Editor de la receta de un producto fabricado (lista de insumos + cantidad por unidad). Se usa al
 * dar de alta un fabricado nuevo y al editar la receta de uno existente, dentro del modal
 * "Crear producto" del detalle de almacén. No guarda nada: el padre decide qué hacer con `lines`.
 */
@Component({
  selector: 'app-recipe-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-editor.component.html',
  styleUrl: './recipe-editor.component.scss'
})
export class RecipeEditorComponent {
  private readonly notify = inject(NotificationService);

  /** Insumos elegibles (kind="Supply", activos, de la empresa del almacén) */
  readonly supplies = input.required<IProduct[]>();

  /** Stock de cada insumo en el almacén, por productId (los que no aparecen tienen 0) */
  readonly supplyStock = input<Record<number, number>>({});

  /** Líneas de la receta (two-way: `[(lines)]`) */
  readonly lines = model.required<IRecipeLine[]>();

  addSupplyId: number | null = null;
  addQuantity: number | null = 1;

  /** Insumos que todavía no están en la receta */
  readonly availableSupplies = computed<IProduct[]>(() => {
    const used = new Set(this.lines().map((l) => l.supplyProductId));
    return this.supplies().filter((s) => !used.has(s.id));
  });

  stockOf(supplyProductId: number): number {
    return this.supplyStock()[supplyProductId] ?? 0;
  }

  /** `step` del input de cantidad a agregar, según la unidad del insumo elegido */
  addStep(): number {
    return quantityStep(this.supplies().find((s) => s.id === this.addSupplyId)?.unitDecimalPlaces);
  }

  lineStep(line: IRecipeLine): number {
    return quantityStep(line.supplyUnitDecimalPlaces);
  }

  onAdd(): void {
    const supply = this.supplies().find((s) => s.id === this.addSupplyId);
    if (!supply || !this.addQuantity || this.addQuantity <= 0) return;
    const decimalsError = quantityDecimalsError(this.addQuantity, supply.unitDecimalPlaces, supply.name, supply.unitName);
    if (decimalsError) {
      this.notify.warn(decimalsError);
      return;
    }
    this.lines.update((lines) => [
      ...lines,
      {
        supplyProductId: supply.id,
        supplyProductName: supply.name,
        supplyUnit: supply.unitAbbreviation,
        supplyUnitDecimalPlaces: supply.unitDecimalPlaces,
        quantity: this.addQuantity!
      }
    ]);
    this.addSupplyId = null;
    this.addQuantity = 1;
  }

  onChangeQuantity(supplyProductId: number, quantity: number): void {
    this.lines.update((lines) =>
      lines.map((l) => (l.supplyProductId === supplyProductId ? { ...l, quantity: quantity || 0 } : l))
    );
  }

  onRemove(supplyProductId: number): void {
    this.lines.update((lines) => lines.filter((l) => l.supplyProductId !== supplyProductId));
  }
}
