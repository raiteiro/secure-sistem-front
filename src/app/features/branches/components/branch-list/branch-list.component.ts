import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { BranchesService } from '../../services/branches.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IBranch, IBranchRequest } from '../../../../core/models/branch.models';
import { IWarehouse } from '../../../../core/models/warehouse.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IBranchForm {
  name: string;
  address: string;
  phone: string;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: IBranchForm = { name: '', address: '', phone: '', companyId: null };

interface IBranchGroup {
  companyId: number;
  companyName: string;
  branches: IBranch[];
}

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './branch-list.component.html',
  styleUrl: './branch-list.component.scss'
})
export class BranchListComponent implements OnInit {
  private readonly branchesService = inject(BranchesService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  branches = signal<IBranch[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  warehouses = signal<IWarehouse[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: IBranchForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadBranches();

    this.warehousesService.getAll().subscribe({
      next: (data) => this.warehouses.set(data),
      error: () => this.notify.error('No se pudieron cargar los almacenes')
    });

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadBranches(): void {
    this.loading.set(true);
    this.branchesService.getAll().subscribe({
      next: (data) => { this.branches.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar las sucursales'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly branchGroups = computed<IBranchGroup[]>(() => {
    const branches = this.branches();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', branches }];
    }

    const byCompany = new Map<number, IBranch[]>();
    for (const branch of branches) {
      const companyId = branch.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(branch);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        branches: list
      }));
  });

  /** El backend solo devuelve sucursales activas, así que el largo del grupo = activas de esa empresa */
  isOnlyActiveBranch(group: IBranchGroup): boolean {
    return group.branches.length <= 1;
  }

  /** Almacenes ligados a esta sucursal (normalmente el auto-creado, pero puede haber más de uno) */
  warehousesOf(branchId: number): IWarehouse[] {
    return this.warehouses().filter((w) => w.branchId === branchId);
  }

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.isEdit.set(false);
    this.editId = 0;
    this.showModal = true;
  }

  onEdit(branch: IBranch): void {
    this.isEdit.set(true);
    this.editId = branch.id;
    this.form = {
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      companyId: null
    };
    this.showModal = true;
  }

  onSave(): void {
    if (!this.form.name) {
      this.notify.warn('El nombre es obligatorio');
      return;
    }

    const request: IBranchRequest = {
      name: this.form.name,
      address: this.form.address || null,
      phone: this.form.phone || null,
      ...(this.form.companyId ? { companyId: this.form.companyId } : {})
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.branchesService.update(this.editId, request)
      : this.branchesService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Sucursal actualizada' : 'Sucursal creada');
        this.loadBranches();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(branch: IBranch, group: IBranchGroup): void {
    if (this.isOnlyActiveBranch(group)) {
      this.notify.warn('No puedes desactivar la única sucursal activa de esta empresa');
      return;
    }

    this.confirmService.confirm({
      message: `¿Desactivar la sucursal "${branch.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.branchesService.deactivate(branch.id).subscribe({
          next: () => { this.notify.success('Sucursal desactivada'); this.loadBranches(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
