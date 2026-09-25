import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { WarehousesService } from '../../services/warehouses.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IWarehouse, IWarehouseRequest } from '../../../../core/models/warehouse.models';
import { IBranch } from '../../../../core/models/branch.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IWarehouseForm {
  name: string;
  address: string;
  branchId: number | null;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: IWarehouseForm = { name: '', address: '', branchId: null, companyId: null };

interface IWarehouseGroup {
  companyId: number;
  companyName: string;
  warehouses: IWarehouse[];
}

@Component({
  selector: 'app-warehouse-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './warehouse-list.component.html',
  styleUrl: './warehouse-list.component.scss'
})
export class WarehouseListComponent implements OnInit {
  private readonly warehousesService = inject(WarehousesService);
  private readonly branchesService = inject(BranchesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  warehouses = signal<IWarehouse[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  allBranches = signal<IBranch[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  /** Empresa del almacén que se está editando (para filtrar el select de sucursales) */
  editCompanyId: number | null = null;
  form: IWarehouseForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadWarehouses();
    this.branchesService.getAll().subscribe({
      next: (data) => this.allBranches.set(data),
      error: () => this.notify.error('No se pudieron cargar las sucursales')
    });

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadWarehouses(): void {
    this.loading.set(true);
    this.warehousesService.getAll().subscribe({
      next: (data) => { this.warehouses.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los almacenes'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly warehouseGroups = computed<IWarehouseGroup[]>(() => {
    const warehouses = this.warehouses();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', warehouses }];
    }

    const byCompany = new Map<number, IWarehouse[]>();
    for (const warehouse of warehouses) {
      const companyId = warehouse.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(warehouse);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        warehouses: list
      }));
  });

  /** El backend solo devuelve almacenes activos, así que el largo del grupo = activos de esa empresa */
  isOnlyActiveWarehouse(group: IWarehouseGroup): boolean {
    return group.warehouses.length <= 1;
  }

  /** Sucursales disponibles para el select del modal, filtradas a la empresa relevante */
  readonly availableBranches = computed<IBranch[]>(() => {
    const branches = this.allBranches();
    const targetCompanyId = this.isEdit()
      ? this.editCompanyId
      : (this.form.companyId ?? this.authService.currentUser()?.companyId ?? null);
    if (!targetCompanyId) return branches;
    return branches.filter((b) => b.companyId === targetCompanyId);
  });

  /** Abre la pantalla de administración del almacén (stock, movimientos, alta de productos) */
  onManage(warehouse: IWarehouse): void {
    this.router.navigate(['/catalogo/almacenes', warehouse.id]);
  }

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.isEdit.set(false);
    this.editId = 0;
    this.editCompanyId = null;
    this.showModal = true;
  }

  onEdit(warehouse: IWarehouse): void {
    this.isEdit.set(true);
    this.editId = warehouse.id;
    this.editCompanyId = warehouse.companyId;
    this.form = {
      name: warehouse.name,
      address: warehouse.address ?? '',
      branchId: warehouse.branchId,
      companyId: null
    };
    this.showModal = true;
  }

  onCompanyChange(): void {
    this.form.branchId = null;
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }

    const request: IWarehouseRequest = {
      name: this.form.name,
      address: this.form.address || null,
      branchId: this.form.branchId,
      ...(!this.form.branchId && this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.warehousesService.update(this.editId, request)
      : this.warehousesService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Almacén actualizado' : 'Almacén creado');
        this.loadWarehouses();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(warehouse: IWarehouse, group: IWarehouseGroup): void {
    if (this.isOnlyActiveWarehouse(group)) {
      this.notify.warn('No puedes desactivar el único almacén activo de esta empresa');
      return;
    }

    this.confirmService.confirm({
      message: `¿Desactivar el almacén "${warehouse.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.warehousesService.deactivate(warehouse.id).subscribe({
          next: () => { this.notify.success('Almacén desactivado'); this.loadWarehouses(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
