import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CashRegistersService } from '../../services/cash-registers.service';
import { BranchesService } from '../../../branches/services/branches.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ICashRegister, ICashRegisterRequest } from '../../../../core/models/cash-register.models';
import { IBranch } from '../../../../core/models/branch.models';
import { ICompany } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface ICashRegisterForm {
  name: string;
  branchId: number | null;
  /** Solo admin de sistema: filtra el select de sucursales por esta empresa (no se envía al backend) */
  companyId: number | null;
}

const EMPTY_FORM: ICashRegisterForm = { name: '', branchId: null, companyId: null };

interface ICashRegisterGroup {
  companyId: number;
  companyName: string;
  cashRegisters: ICashRegister[];
}

@Component({
  selector: 'app-cash-register-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './cash-register-list.component.html',
  styleUrl: './cash-register-list.component.scss'
})
export class CashRegisterListComponent implements OnInit {
  private readonly cashRegistersService = inject(CashRegistersService);
  private readonly branchesService = inject(BranchesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  cashRegisters = signal<ICashRegister[]>([]);
  loading = signal(true);
  companies = signal<ICompany[]>([]);
  allBranches = signal<IBranch[]>([]);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  /** Empresa de la caja que se está editando (para filtrar el select de sucursales) */
  editCompanyId: number | null = null;
  form: ICashRegisterForm = { ...EMPTY_FORM };

  ngOnInit(): void {
    this.loadCashRegisters();
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

  loadCashRegisters(): void {
    this.loading.set(true);
    this.cashRegistersService.getAll().subscribe({
      next: (data) => { this.cashRegisters.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar las cajas'); this.loading.set(false); }
    });
  }

  companyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies().find((c) => c.id === companyId)?.name ?? `#${companyId}`;
  }

  /** Separa la tabla por empresa cuando quien mira es admin de sistema; para el resto es un único grupo */
  readonly cashRegisterGroups = computed<ICashRegisterGroup[]>(() => {
    const cashRegisters = this.cashRegisters();
    if (!this.authService.isSystemAdmin()) {
      return [{ companyId: 0, companyName: '', cashRegisters }];
    }

    const byCompany = new Map<number, ICashRegister[]>();
    for (const cashRegister of cashRegisters) {
      const companyId = cashRegister.companyId ?? 0;
      const list = byCompany.get(companyId) ?? [];
      list.push(cashRegister);
      byCompany.set(companyId, list);
    }

    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, list]) => ({
        companyId,
        companyName: this.companyName(companyId),
        cashRegisters: list
      }));
  });

  /** Sucursales disponibles para el select del modal, filtradas a la empresa relevante */
  readonly availableBranches = computed<IBranch[]>(() => {
    const branches = this.allBranches();
    const targetCompanyId = this.isEdit()
      ? this.editCompanyId
      : (this.form.companyId ?? this.authService.currentUser()?.companyId ?? null);
    if (!targetCompanyId) return branches;
    return branches.filter((b) => b.companyId === targetCompanyId);
  });

  // ===== Crear / editar =====
  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa */
  onCreate(companyId?: number): void {
    this.form = { ...EMPTY_FORM, companyId: companyId ?? null };
    this.isEdit.set(false);
    this.editId = 0;
    this.editCompanyId = null;
    this.showModal = true;
  }

  onEdit(cashRegister: ICashRegister): void {
    this.isEdit.set(true);
    this.editId = cashRegister.id;
    this.editCompanyId = cashRegister.companyId;
    this.form = { name: cashRegister.name, branchId: cashRegister.branchId, companyId: null };
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
    if (!this.form.branchId) {
      this.notify.warn('Selecciona una sucursal');
      return;
    }

    const request: ICashRegisterRequest = { name: this.form.name, branchId: this.form.branchId };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.cashRegistersService.update(this.editId, request)
      : this.cashRegistersService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Caja actualizada' : 'Caja creada');
        this.loadCashRegisters();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  onDeactivate(cashRegister: ICashRegister): void {
    if (cashRegister.hasOpenSession) {
      this.notify.warn('No puedes desactivar una caja con un turno abierto');
      return;
    }

    this.confirmService.confirm({
      message: `¿Desactivar la caja "${cashRegister.name}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.cashRegistersService.deactivate(cashRegister.id).subscribe({
          next: () => { this.notify.success('Caja desactivada'); this.loadCashRegisters(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }
}
