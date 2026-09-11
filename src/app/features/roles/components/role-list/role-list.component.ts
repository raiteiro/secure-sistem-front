import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { RolesService } from '../../services/roles.service';
import { NavRoutesService } from '../../../nav-routes/services/nav-routes.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { IRole } from '../../../../core/models/role.models';
import { INavigationRoute } from '../../../../core/models/navigation.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IRoleGroup {
  companyId: number;
  companyName: string;
  roles: IRole[];
}

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, ConfirmDialogModule, DialogModule],
  providers: [ConfirmationService],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss'
})
export class RoleListComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly navService = inject(NavRoutesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  roles = signal<IRole[]>([]);
  loading = signal(true);
  private companyNames = new Map<number, string>();

  // Role modal
  showRoleModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  roleForm = { name: '', description: '' };
  /** Empresa destino al crear desde el botón "+" de un grupo (null = mi empresa) */
  createCompanyId: number | null = null;

  // Routes modal
  showRoutesModal = false;
  savingRoutes = signal(false);
  routesRoleId = 0;
  routesRoleName = '';
  allRoutes = signal<INavigationRoute[]>([]);
  selectedRouteIds = signal<Set<number>>(new Set());

  ngOnInit(): void {
    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (companies) => {
          companies.forEach((c) => this.companyNames.set(c.id, c.name));
          this.loadRoles();
        },
        error: () => this.loadRoles()
      });
    } else {
      this.loadRoles();
    }
  }

  loadRoles(): void {
    this.loading.set(true);
    this.rolesService.getAll().subscribe({
      next: (data) => { this.roles.set(data); this.loading.set(false); },
      error: () => { this.msg('error', 'No se pudieron cargar los roles'); this.loading.set(false); }
    });
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly roleGroups = computed<IRoleGroup[]>(() => {
    const roles = this.roles();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', roles }];
    }

    const byCompany = new Map<number, IRole[]>();
    for (const role of roles) {
      const companyId = role.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(role);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyNames.get(companyId) ?? `Empresa #${companyId}`,
        roles: list
      }));
  });

  // ===== Role CRUD =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.roleForm = { name: '', description: '' };
    this.createCompanyId = companyId ?? null;
    this.isEdit.set(false); this.editId = 0; this.showRoleModal = true;
  }

  onEdit(role: IRole): void {
    this.isEdit.set(true); this.editId = role.id;
    this.createCompanyId = null;
    this.roleForm = { name: role.name, description: role.description };
    this.showRoleModal = true;
  }

  companyName(companyId: number | null): string {
    if (!companyId) return '';
    return this.companyNames.get(companyId) ?? `Empresa #${companyId}`;
  }

  onSaveRole(): void {
    if (!this.roleForm.name) { this.msg('warn', 'El nombre es obligatorio'); return; }
    this.saving.set(true);
    const obs = this.isEdit()
      ? this.rolesService.update(this.editId, this.roleForm)
      : this.rolesService.create(this.createCompanyId ? { ...this.roleForm, companyId: this.createCompanyId } : this.roleForm);
    obs.subscribe({
      next: () => { this.saving.set(false); this.showRoleModal = false; this.msg('success', this.isEdit() ? 'Rol actualizado' : 'Rol creado'); this.loadRoles(); },
      error: (e) => { this.saving.set(false); this.msgErr(e); }
    });
  }

  onDeactivate(role: IRole): void {
    this.confirmService.confirm({
      message: `¿Desactivar el rol "${role.name}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'Cancelar',
      accept: () => {
        this.rolesService.deactivate(role.id).subscribe({
          next: () => { this.msg('success', 'Rol desactivado'); this.loadRoles(); },
          error: (e) => this.msgErr(e)
        });
      }
    });
  }

  // ===== Route assignment =====
  onManageRoutes(role: IRole): void {
    this.routesRoleId = role.id;
    this.routesRoleName = role.name;
    this.selectedRouteIds.set(new Set(role.routeIds || []));

    this.navService.getTree().subscribe({
      next: (tree) => {
        // Para admin de sistema el árbol trae todas las empresas mezcladas; acotarlo a la del rol
        const scoped = role.companyId != null ? tree.filter((r) => r.companyId === role.companyId) : tree;
        this.allRoutes.set(scoped);
        this.showRoutesModal = true;
      },
      error: () => this.msg('error', 'No se pudieron cargar las rutas')
    });
  }

  toggleRoute(id: number): void {
    this.selectedRouteIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  isRouteSelected(id: number): boolean {
    return this.selectedRouteIds().has(id);
  }

  onSaveRoutes(): void {
    this.savingRoutes.set(true);
    this.rolesService.assignRoutes(this.routesRoleId, { routeIds: [...this.selectedRouteIds()] }).subscribe({
      next: () => { this.savingRoutes.set(false); this.showRoutesModal = false; this.msg('success', 'Rutas asignadas'); this.loadRoles(); },
      error: (e) => { this.savingRoutes.set(false); this.msgErr(e); }
    });
  }

  private msg(sev: string, detail: string): void {
    if (sev === 'success') this.notify.success(detail);
    else if (sev === 'warn') this.notify.warn(detail);
    else this.notify.error(detail);
  }
  private msgErr(e: unknown): void { this.notify.httpError(e); }
}
