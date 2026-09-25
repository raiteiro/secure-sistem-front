import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { SuppliersService } from '../../services/suppliers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ISupplier, ISupplierRequest } from '../../../../core/models/supplier.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface ISupplierForm {
  name: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  isConsignor: boolean;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: ISupplierForm = {
  name: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  isConsignor: false,
  companyId: null
};

interface ISupplierGroup {
  companyId: number;
  companyName: string;
  suppliers: ISupplier[];
}

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.scss'
})
export class SupplierListComponent implements OnInit {
  private readonly suppliersService = inject(SuppliersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  suppliers = signal<ISupplier[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: ISupplierForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadSuppliers();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadSuppliers(): void {
    this.loading.set(true);
    this.suppliersService.getAll().subscribe({
      next: (data) => { this.suppliers.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los proveedores'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly supplierGroups = computed<ISupplierGroup[]>(() => {
    const suppliers = this.suppliers();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', suppliers }];
    }

    const byCompany = new Map<number, ISupplier[]>();
    for (const supplier of suppliers) {
      const companyId = supplier.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(supplier);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        suppliers: list
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

  onEdit(supplier: ISupplier): void {
    this.isEdit.set(true);
    this.editId = supplier.id;
    this.form = {
      name: supplier.name,
      taxId: supplier.taxId ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      isConsignor: supplier.isConsignor,
      companyId: null
    };
    this.showModal = true;
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }

    const request: ISupplierRequest = {
      name: this.form.name,
      taxId: this.form.taxId || null,
      phone: this.form.phone || null,
      email: this.form.email || null,
      address: this.form.address || null,
      isConsignor: this.form.isConsignor,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.suppliersService.update(this.editId, request)
      : this.suppliersService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Proveedor actualizado' : 'Proveedor creado');
        this.loadSuppliers();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(supplier: ISupplier): void {
    this.confirmService.confirm({
      message: `¿Desactivar el proveedor "${supplier.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.suppliersService.deactivate(supplier.id).subscribe({
          next: () => { this.notify.success('Proveedor desactivado'); this.loadSuppliers(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
