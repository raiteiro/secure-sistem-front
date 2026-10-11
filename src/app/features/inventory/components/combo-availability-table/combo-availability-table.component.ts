import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { IComboAvailability } from '../../../../core/models/inventory.models';

/**
 * Tabla de solo lectura con cuántos combos se pueden vender por almacén, calculado por el backend
 * con el stock de sus componentes (un combo no tiene stock propio). Se usa en Inventario y en el
 * detalle de Almacén — ninguna de las dos le da acciones: el stock se mueve sobre los componentes.
 */
@Component({
  selector: 'app-combo-availability-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './combo-availability-table.component.html',
  styleUrl: './combo-availability-table.component.scss'
})
export class ComboAvailabilityTableComponent {
  /** Filas de GET /api/Inventory/combo-availability */
  readonly combos = input.required<IComboAvailability[]>();

  /** Muestra el indicador de carga de la tabla */
  readonly loading = input(false);

  /** Agrega la columna "Almacén" (vista con varios almacenes, ej. Inventario) */
  readonly showWarehouse = input(false);
}
