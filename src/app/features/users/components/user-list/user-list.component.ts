import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UsersService } from '../../services/users.service';
import { RolesService } from '../../../roles/services/roles.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  IUser,
  ICreateUserRequest,
  IUpdateUserRequest,
  IReassignCompanyRequest,
  ISetUserCompanyAccessRequest
} from '../../../../core/models/user.models';
import { IRole } from '../../../../core/models/role.models';
import { ICompany } from '../../../../core/models/company.models';
import { IBranch } from '../../../../core/models/branch.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IUserForm {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
  /** null = sin asignar, puede abrir turno en cualquier caja de su empresa */
  branchId: number | null;
  /** Solo se usa al crear, y solo si el que llama es admin de sistema */
  companyId: number | null;
}

const EMPTY_FORM: IUserForm = {
  username: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  roleId: 0,
  branchId: null,
  companyId: null
};

interface IReassignForm {
  companyId: number | null;
  roleId: number | null;
}

const EMPTY_REASSIGN_FORM: IReassignForm = { companyId: null, roleId: null };

/** Una fila del modal "Empresas adicionales": empresa + el rol que tendrá ahí */
interface ICompanyAccessGrantRow {
  companyId: number | null;
  roleId: number | null;
}

interface IUserGroup {
  companyId: number;
  companyName: string;
  users: IUser[];
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ConfirmDialogModule,
    TooltipModule,
    DialogModule,
    HasPermissionDirective
  ],
  providers: [ConfirmationService],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly branchesService = inject(BranchesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  users = signal<IUser[]>([]);
  loading = signal(true);
  roles = signal<IRole[]>([]);
  companies = signal<ICompany[]>([]);
  branches = signal<IBranch[]>([]);

  // Modal crear/editar
  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: IUserForm = { ...EMPTY_FORM };
  /** Empresa del usuario que se está editando (para filtrar el selector de rol); en creación se usa form.companyId */
  editUserCompanyId: number | null = null;

  // Modal cambiar de empresa (solo admin de sistema)
  showReassignModal = false;
  reassigning = signal(false);
  reassignUserId = 0;
  reassignUsername = '';
  reassignForm: IReassignForm = { ...EMPTY_REASSIGN_FORM };

  // Modal empresas adicionales (solo admin de sistema)
  showCompanyAccessModal = false;
  loadingCompanyAccess = signal(false);
  savingCompanyAccess = signal(false);
  companyAccessUserId = 0;
  companyAccessUsername = '';
  companyAccessHomeCompanyId: number | null = null;
  companyAccessForm: { canSwitchCompany: boolean; grants: ICompanyAccessGrantRow[] } = {
    canSwitchCompany: false,
    grants: []
  };

  // Modal contraseña temporal (tras restablecer)
  showTempPasswordModal = false;
  resettingPassword = signal(false);
  tempPasswordUsername = '';
  tempPassword = '';
  tempPasswordCopied = signal(false);

  ngOnInit(): void {
    this.loadUsers();

    this.rolesService.getAll().subscribe({
      next: (data) => this.roles.set(data),
      error: () => this.notify.error('No se pudieron cargar los roles')
    });

    this.branchesService.getAll().subscribe({
      next: (data) => this.branches.set(data),
      error: () => this.notify.error('No se pudieron cargar las sucursales')
    });

    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (data) => this.companies.set(data),
        error: () => this.notify.error('No se pudieron cargar las empresas')
      });
    }
  }

  loadUsers(): void {
    this.loading.set(true);
    this.usersService.getAll().subscribe({
      next: (data) => { this.users.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar los usuarios'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly userGroups = computed<IUserGroup[]>(() => {
    const users = this.users();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', users }];
    }

    const byCompany = new Map<number, IUser[]>();
    for (const user of users) {
      const companyId = user.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(user);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        users: list
      }));
  });

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.editUserCompanyId = null;
    this.isEdit.set(false);
    this.editId = 0;
    this.showModal = true;
  }

  onEdit(user: IUser): void {
    this.isEdit.set(true);
    this.editId = user.id;
    this.editUserCompanyId = user.companyId ?? null;
    this.form = {
      username: user.username,
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      roleId: user.roleId,
      branchId: user.branchId ?? null,
      companyId: null
    };
    this.showModal = true;
  }

  /** Roles visibles en el selector del modal crear/editar, acotados a la empresa objetivo */
  availableRoles(): IRole[] {
    if (!this.authService.isSystemAdmin()) return this.roles();
    const targetCompanyId = this.isEdit()
      ? this.editUserCompanyId
      : this.form.companyId ?? this.authService.currentUser()?.companyId ?? null;
    if (!targetCompanyId) return this.roles();
    return this.roles().filter((r) => r.companyId === targetCompanyId);
  }

  /** Sucursales visibles en el selector del modal crear/editar, acotadas a la empresa objetivo */
  availableBranches(): IBranch[] {
    if (!this.authService.isSystemAdmin()) return this.branches();
    const targetCompanyId = this.isEdit()
      ? this.editUserCompanyId
      : this.form.companyId ?? this.authService.currentUser()?.companyId ?? null;
    if (!targetCompanyId) return this.branches();
    return this.branches().filter((b) => b.companyId === targetCompanyId);
  }

  /** Se llama al cambiar la empresa en el modal de creación: el rol y la sucursal elegidos pueden ya no ser válidos */
  onCreateCompanyChange(): void {
    this.form.roleId = 0;
    this.form.branchId = null;
  }

  /** Roles visibles en el selector del modal "Cambiar de empresa", acotados a la empresa destino */
  availableReassignRoles(): IRole[] {
    if (!this.reassignForm.companyId) return this.roles();
    return this.roles().filter((r) => r.companyId === this.reassignForm.companyId);
  }

  /** Se llama al cambiar la empresa destino en el modal de reasignación: el rol elegido puede ya no ser válido */
  onReassignCompanyChange(): void {
    this.reassignForm.roleId = null;
  }

  onSave(): void {
    if (!this.form.username || !this.form.email || !this.form.firstName || !this.form.lastName) {
      this.notify.warn('Completa los campos obligatorios');
      return;
    }
    if (!this.isEdit() && !this.form.password) {
      this.notify.warn('La contraseña es obligatoria');
      return;
    }

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.usersService.update(this.editId, this.toUpdateRequest())
      : this.usersService.create(this.toCreateRequest());

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Usuario actualizado' : 'Usuario creado');
        this.loadUsers();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(user: IUser): void {
    this.confirmService.confirm({
      message: `¿Desactivar al usuario "${user.username}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.usersService.deactivate(user.id).subscribe({
          next: () => { this.notify.success('Usuario desactivado'); this.loadUsers(); },
          error: () => this.notify.error('No se pudo desactivar el usuario')
        });
      }
    });
  }

  // ===== Restablecer contraseña =====
  onResetPassword(user: IUser): void {
    this.confirmService.confirm({
      message: `¿Restablecer la contraseña de "${user.username}"? Se generará una contraseña temporal, deberá cambiarla al volver a entrar, y se cerrarán todas sus sesiones activas.`,
      header: 'Confirmar restablecimiento',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, restablecer',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.resettingPassword.set(true);
        this.usersService.resetPassword(user.id).subscribe({
          next: (response) => {
            this.resettingPassword.set(false);
            this.tempPasswordUsername = user.username;
            this.tempPassword = response.temporaryPassword;
            this.tempPasswordCopied.set(false);
            this.showTempPasswordModal = true;
            this.loadUsers();
          },
          error: (e) => { this.resettingPassword.set(false); this.notify.httpError(e); }
        });
      }
    });
  }

  copyTempPassword(): void {
    navigator.clipboard.writeText(this.tempPassword).then(() => {
      this.tempPasswordCopied.set(true);
      setTimeout(() => this.tempPasswordCopied.set(false), 2000);
    });
  }

  // ===== Cambiar de empresa =====
  onReassign(user: IUser): void {
    this.reassignUserId = user.id;
    this.reassignUsername = user.username;
    this.reassignForm = { ...EMPTY_REASSIGN_FORM };
    this.showReassignModal = true;
  }

  onSaveReassign(): void {
    if (!this.reassignForm.companyId || !this.reassignForm.roleId) {
      this.notify.warn('Selecciona la empresa y el rol destino');
      return;
    }

    const companyId = this.reassignForm.companyId;
    const roleId = this.reassignForm.roleId;

    this.confirmService.confirm({
      message: `¿Mover a "${this.reassignUsername}" a "${this.companyName(companyId)}"? Se cerrarán todas sus sesiones activas (deberá volver a loguearse) y perderá sus rutas asignadas directamente.`,
      header: 'Confirmar cambio de empresa',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, mover',
      rejectLabel: 'Cancelar',
      accept: () => {
        const request: IReassignCompanyRequest = { companyId, roleId };
        this.reassigning.set(true);
        this.usersService.reassignCompany(this.reassignUserId, request).subscribe({
          next: () => {
            this.reassigning.set(false);
            this.showReassignModal = false;
            this.notify.success('Usuario movido de empresa. Sus sesiones activas fueron cerradas.');
            this.loadUsers();
          },
          error: (e) => { this.reassigning.set(false); this.notify.httpError(e); }
        });
      }
    });
  }

  // ===== Empresas adicionales (puede cambiar entre empresas) =====
  onManageCompanyAccess(user: IUser): void {
    this.companyAccessUserId = user.id;
    this.companyAccessUsername = user.username;
    this.companyAccessHomeCompanyId = user.companyId ?? null;
    this.companyAccessForm = { canSwitchCompany: false, grants: [] };
    this.showCompanyAccessModal = true;

    this.loadingCompanyAccess.set(true);
    this.usersService.getCompanyAccess(user.id).subscribe({
      next: (data) => {
        this.companyAccessForm = {
          canSwitchCompany: data.canSwitchCompany,
          grants: data.grants.map((g) => ({ companyId: g.companyId, roleId: g.roleId }))
        };
        this.loadingCompanyAccess.set(false);
      },
      error: (e) => {
        this.loadingCompanyAccess.set(false);
        this.showCompanyAccessModal = false;
        this.notify.httpError(e);
      }
    });
  }

  /** Empresas que ya no están disponibles para elegir en una fila: la de origen del usuario y las que ya usa otra fila */
  availableGrantCompanies(row: ICompanyAccessGrantRow): ICompany[] {
    const usedElsewhere = new Set(
      this.companyAccessForm.grants.filter((g) => g !== row && g.companyId !== null).map((g) => g.companyId)
    );
    return this.companies().filter(
      (c) => c.id !== this.companyAccessHomeCompanyId && !usedElsewhere.has(c.id)
    );
  }

  /** Roles disponibles para una fila, acotados a la empresa elegida en esa misma fila */
  availableGrantRoles(row: ICompanyAccessGrantRow): IRole[] {
    if (!row.companyId) return [];
    return this.roles().filter((r) => r.companyId === row.companyId);
  }

  /** Al cambiar la empresa de una fila, el rol elegido puede ya no ser válido */
  onGrantCompanyChange(row: ICompanyAccessGrantRow): void {
    row.roleId = null;
  }

  addGrantRow(): void {
    this.companyAccessForm.grants = [...this.companyAccessForm.grants, { companyId: null, roleId: null }];
  }

  removeGrantRow(row: ICompanyAccessGrantRow): void {
    this.companyAccessForm.grants = this.companyAccessForm.grants.filter((g) => g !== row);
  }

  onSaveCompanyAccess(): void {
    for (const row of this.companyAccessForm.grants) {
      if (!row.companyId || !row.roleId) {
        this.notify.warn('Completa la empresa y el rol de cada fila, o quítala con el botón de la derecha');
        return;
      }
    }

    const request: ISetUserCompanyAccessRequest = {
      canSwitchCompany: this.companyAccessForm.canSwitchCompany,
      grants: this.companyAccessForm.grants.map((g) => ({ companyId: g.companyId!, roleId: g.roleId! }))
    };

    this.savingCompanyAccess.set(true);
    this.usersService.setCompanyAccess(this.companyAccessUserId, request).subscribe({
      next: () => {
        this.savingCompanyAccess.set(false);
        this.showCompanyAccessModal = false;
        this.notify.success('Acceso entre empresas actualizado');
        this.loadUsers();
      },
      error: (e) => { this.savingCompanyAccess.set(false); this.notify.httpError(e); }
    });
  }

  private toCreateRequest(): ICreateUserRequest {
    const { companyId, branchId, ...rest } = this.form;
    return {
      ...rest,
      ...(companyId ? { companyId } : {}),
      ...(branchId ? { branchId } : {})
    };
  }

  private toUpdateRequest(): IUpdateUserRequest {
    const { password, companyId, branchId, ...body } = this.form;
    return { ...body, ...(branchId ? { branchId } : {}) };
  }
}
