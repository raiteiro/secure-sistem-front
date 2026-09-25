import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { TaxRatesService } from '../../services/tax-rates.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ITaxRate, ITaxRateRequest } from '../../../../core/models/tax-rate.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface ITaxRateForm {
  name: string;
  /** El usuario captura porcentaje (ej: 16), se convierte a fracción (0.16) al guardar */
  ratePercent: number | null;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: ITaxRateForm = { name: '', ratePercent: null, companyId: null };

interface ITaxRateGroup {
  companyId: number;
  companyName: string;
  taxRates: ITaxRate[];
}

@Component({
  selector: 'app-tax-rate-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './tax-rate-list.component.html',
  styleUrl: './tax-rate-list.component.scss'
})
export class TaxRateListComponent implements OnInit {
  private readonly taxRatesService = inject(TaxRatesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  taxRates = signal<ITaxRate[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: ITaxRateForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadTaxRates();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadTaxRates(): void {
    this.loading.set(true);
    this.taxRatesService.getAll().subscribe({
      next: (data) => { this.taxRates.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los impuestos'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly taxRateGroups = computed<ITaxRateGroup[]>(() => {
    const taxRates = this.taxRates();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', taxRates }];
    }

    const byCompany = new Map<number, ITaxRate[]>();
    for (const taxRate of taxRates) {
      const companyId = taxRate.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(taxRate);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        taxRates: list
      }));
  });

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.isEdit.set(false);
    this.editId = 0;
    this.showModal = true;
  }

  onEdit(taxRate: ITaxRate): void {
    this.isEdit.set(true);
    this.editId = taxRate.id;
    this.form = {
      name: taxRate.name,
      ratePercent: taxRate.rate * 100,
      companyId: null
    };
    this.showModal = true;
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }
    if (this.form.ratePercent === null || this.form.ratePercent < 0 || this.form.ratePercent > 100) {
      this.notify.warn('Ingresa una tasa válida entre 0 y 100');
      return;
    }

    const request: ITaxRateRequest = {
      name: this.form.name,
      rate: this.form.ratePercent / 100,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.taxRatesService.update(this.editId, request)
      : this.taxRatesService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Impuesto actualizado' : 'Impuesto creado');
        this.loadTaxRates();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(taxRate: ITaxRate): void {
    this.confirmService.confirm({
      message: `¿Desactivar el impuesto "${taxRate.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.taxRatesService.deactivate(taxRate.id).subscribe({
          next: () => { this.notify.success('Impuesto desactivado'); this.loadTaxRates(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
