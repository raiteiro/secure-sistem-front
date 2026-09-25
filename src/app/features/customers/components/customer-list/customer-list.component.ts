import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CustomersService } from '../../services/customers.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ICustomer, ICustomerRequest } from '../../../../core/models/customer.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface ICustomerForm {
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: ICustomerForm = { name: '', email: '', phone: '', taxId: '', address: '', companyId: null };

interface ICustomerGroup {
  companyId: number;
  companyName: string;
  customers: ICustomer[];
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss'
})
export class CustomerListComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  customers = signal<ICustomer[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: ICustomerForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadCustomers();

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.customersService.getAll().subscribe({
      next: (data) => { this.customers.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los clientes'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly customerGroups = computed<ICustomerGroup[]>(() => {
    const customers = this.customers();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', customers }];
    }

    const byCompany = new Map<number, ICustomer[]>();
    for (const customer of customers) {
      const companyId = customer.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(customer);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        customers: list
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

  onEdit(customer: ICustomer): void {
    this.isEdit.set(true);
    this.editId = customer.id;
    this.form = {
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      taxId: customer.taxId ?? '',
      address: customer.address ?? '',
      companyId: null
    };
    this.showModal = true;
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }

    const request: ICustomerRequest = {
      name: this.form.name,
      email: this.form.email || null,
      phone: this.form.phone || null,
      taxId: this.form.taxId || null,
      address: this.form.address || null,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.customersService.update(this.editId, request)
      : this.customersService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Cliente actualizado' : 'Cliente creado');
        this.loadCustomers();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(customer: ICustomer): void {
    this.confirmService.confirm({
      message: `¿Desactivar al cliente "${customer.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.customersService.deactivate(customer.id).subscribe({
          next: () => { this.notify.success('Cliente desactivado'); this.loadCustomers(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
