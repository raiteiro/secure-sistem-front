import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ProductExtrasService } from '../../services/product-extras.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IProductExtra, IProductExtraRequest } from '../../../../core/models/product-extra.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IProductExtraForm {
  name: string;
  price: number | null;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: IProductExtraForm = { name: '', price: null, companyId: null };

interface IProductExtraGroup {
  companyId: number;
  companyName: string;
  extras: IProductExtra[];
}

@Component({
  selector: 'app-product-extra-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './product-extra-list.component.html',
  styleUrl: './product-extra-list.component.scss'
})
export class ProductExtraListComponent implements OnInit {
  private readonly extrasService = inject(ProductExtrasService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  extras = signal<IProductExtra[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: IProductExtraForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadExtras();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadExtras(): void {
    this.loading.set(true);
    this.extrasService.getAll().subscribe({
      next: (data) => { this.extras.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los extras'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly extraGroups = computed<IProductExtraGroup[]>(() => {
    const extras = this.extras();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', extras }];
    }

    const byCompany = new Map<number, IProductExtra[]>();
    for (const extra of extras) {
      const companyId = extra.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(extra);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        extras: list
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

  onEdit(extra: IProductExtra): void {
    this.isEdit.set(true);
    this.editId = extra.id;
    this.form = {
      name: extra.name,
      price: extra.price,
      companyId: null
    };
    this.showModal = true;
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

    const request: IProductExtraRequest = {
      name: this.form.name,
      price: this.form.price,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.extrasService.update(this.editId, request)
      : this.extrasService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Extra actualizado' : 'Extra creado');
        this.loadExtras();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(extra: IProductExtra): void {
    this.confirmService.confirm({
      message: `¿Desactivar el extra "${extra.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.extrasService.deactivate(extra.id).subscribe({
          next: () => { this.notify.success('Extra desactivado'); this.loadExtras(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
