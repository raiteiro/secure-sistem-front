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
import { AuthService } from '../../../../core/services/auth.service';
import {
  IUser,
  ICreateUserRequest,
  IUpdateUserRequest,
  IReassignCompanyRequest
} from '../../../../core/models/user.models';
import { IRole } from '../../../../core/models/role.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface IUserForm {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roleId: number;
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
  companyId: null
};

interface IReassignForm {
  companyId: number | null;
  roleId: number | null;
}

const EMPTY_REASSIGN_FORM: IReassignForm = { companyId: null, roleId: null };

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
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  users = signal<IUser[]>([]);
  loading = signal(true);
  roles = signal<IRole[]>([]);
  companies = signal<ICompany[]>([]);

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

  /** Se llama al cambiar la empresa en el modal de creación: el rol elegido puede ya no ser válido */
  onCreateCompanyChange(): void {
    this.form.roleId = 0;
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

  private toCreateRequest(): ICreateUserRequest {
    const { companyId, ...rest } = this.form;
    return companyId ? { ...rest, companyId } : rest;
  }

  private toUpdateRequest(): IUpdateUserRequest {
    const { password, companyId, ...body } = this.form;
    return body;
  }
}
