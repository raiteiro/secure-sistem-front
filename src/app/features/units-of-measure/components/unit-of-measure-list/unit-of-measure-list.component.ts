import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { UnitsOfMeasureService } from '../../services/units-of-measure.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IUnitOfMeasure, IUnitOfMeasureRequest } from '../../../../core/models/unit-of-measure.models';
import { MAX_QUANTITY_DECIMALS } from '../../../../core/utils/quantity.util';

interface IUnitForm {
  name: string;
  abbreviation: string;
  decimalPlaces: number;
}

const EMPTY_FORM: IUnitForm = { name: '', abbreviation: '', decimalPlaces: 0 };

/** Ejemplo de la cantidad más fina que admite cada número de decimales, para el selector */
const DECIMAL_OPTIONS = Array.from({ length: MAX_QUANTITY_DECIMALS + 1 }, (_, decimals) => ({
  value: decimals,
  label: decimals === 0 ? 'Solo enteros (ej. 3)' : `${decimals} decimal${decimals === 1 ? '' : 'es'} (ej. ${(1.5).toFixed(decimals)})`
}));

/**
 * Catálogo global de unidades de medida. Lo ve cualquier usuario; crear, editar y desactivar es solo
 * del admin de sistema (el backend lo exige). La unidad de un producto decide qué cantidades acepta.
 */
@Component({
  selector: 'app-unit-of-measure-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './unit-of-measure-list.component.html',
  styleUrl: './unit-of-measure-list.component.scss'
})
export class UnitOfMeasureListComponent implements OnInit {
  private readonly unitsService = inject(UnitsOfMeasureService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  readonly decimalOptions = DECIMAL_OPTIONS;

  units = signal<IUnitOfMeasure[]>([]);
  loading = signal(true);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  /** Unidad en edición usada por productos: no se le pueden bajar los decimales */
  editInUse = false;
  editOriginalDecimals = 0;
  form: IUnitForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadUnits();
  }

  loadUnits(): void {
    this.loading.set(true);
    this.unitsService.getAll(this.authService.isSystemAdmin()).subscribe({
      next: (data) => { this.units.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar las unidades de medida'); this.loading.set(false); }
    });
  }

  decimalsLabel(decimals: number): string {
    return DECIMAL_OPTIONS.find((o) => o.value === decimals)?.label ?? `${decimals}`;
  }

  onCreate(): void {
    this.form = { ...EMPTY_FORM };
    this.isEdit.set(false);
    this.editId = 0;
    this.editInUse = false;
    this.showModal = true;
  }

  onEdit(unit: IUnitOfMeasure): void {
    this.form = { name: unit.name, abbreviation: unit.abbreviation, decimalPlaces: unit.decimalPlaces };
    this.isEdit.set(true);
    this.editId = unit.id;
    this.editInUse = unit.productCount > 0;
    this.editOriginalDecimals = unit.decimalPlaces;
    this.showModal = true;
  }

  /** Bajar decimales a una unidad en uso dejaría stock/cantidades existentes fuera de la regla */
  isDecimalOptionDisabled(value: number): boolean {
    return this.isEdit() && this.editInUse && value < this.editOriginalDecimals;
  }

  onSave(): void {
    if (!this.form.name.trim() || !this.form.abbreviation.trim()) {
      this.notify.warn('Nombre y abreviatura son obligatorios');
      return;
    }
    if (this.isDecimalOptionDisabled(this.form.decimalPlaces)) {
      this.notify.warn('La unidad ya la usan productos: no se le pueden bajar los decimales');
      return;
    }

    const request: IUnitOfMeasureRequest = {
      name: this.form.name.trim(),
      abbreviation: this.form.abbreviation.trim(),
      decimalPlaces: this.form.decimalPlaces
    };

    this.saving.set(true);
    const obs = this.isEdit() ? this.unitsService.update(this.editId, request) : this.unitsService.create(request);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Unidad actualizada' : 'Unidad creada');
        this.loadUnits();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(unit: IUnitOfMeasure): void {
    const inUse = unit.productCount > 0
      ? ` Los ${unit.productCount} producto(s) que la usan la conservan, pero ya no se podrá elegir para productos nuevos.`
      : '';
    this.confirmService.confirm({
      message: `¿Desactivar la unidad "${unit.name}"?${inUse}`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.unitsService.deactivate(unit.id).subscribe({
          next: () => { this.notify.success('Unidad desactivada'); this.loadUnits(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }

  onActivate(unit: IUnitOfMeasure): void {
    this.unitsService.activate(unit.id).subscribe({
      next: () => { this.notify.success('Unidad activada'); this.loadUnits(); },
      error: (e) => this.notify.httpError(e)
    });
  }
}
