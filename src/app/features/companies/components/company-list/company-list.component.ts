import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CompaniesService } from '../../services/companies.service';
import { ICompany, ICompanyRequest } from '../../../../core/models/company.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { COLOR_PRESETS, DEFAULT_PRESET_ID, IColorPreset } from '../../../../core/constants/color-presets';
import { AuthService } from '../../../../core/services/auth.service';

interface ICompanyForm {
  name: string;
  taxId: string;
  maxUsers: number | null;
  maxConcurrentSessions: number | null;
  subscriptionExpiresAt: string | null; // yyyy-MM-dd para el <input type="date">
  colorPreset: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tikTok: string;
  whatsApp: string;
}

const EMPTY_FORM: ICompanyForm = {
  name: '',
  taxId: '',
  maxUsers: null,
  maxConcurrentSessions: null,
  subscriptionExpiresAt: null,
  colorPreset: DEFAULT_PRESET_ID,
  address: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  facebook: '',
  tikTok: '',
  whatsApp: ''
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule, ConfirmDialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss'
})
export class CompanyListComponent implements OnInit {
  private readonly companiesService = inject(CompaniesService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly notify = inject(NotificationService);
  readonly authService = inject(AuthService);

  readonly presets = COLOR_PRESETS;

  companies = signal<ICompany[]>([]);
  loading = signal(true);

  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  form: ICompanyForm = { ...EMPTY_FORM };

  // Logo (solo disponible editando, requiere un id existente)
  uploadingLogo = signal(false);
  logoUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading.set(true);
    this.companiesService.getAll().subscribe({
      next: (data) => { this.companies.set(data); this.loading.set(false); },
      error: () => { this.notify.error('No se pudieron cargar las empresas'); this.loading.set(false); }
    });
  }

  logoThumbUrl(company: ICompany): string | null {
    return this.companiesService.getLogoUrl(company.logoPath);
  }

  presetOf(company: ICompany): IColorPreset {
    return COLOR_PRESETS.find((p) => p.id === company.colorPreset) ?? COLOR_PRESETS[0];
  }

  onCreate(): void {
    this.form = { ...EMPTY_FORM };
    this.isEdit.set(false);
    this.editId = 0;
    this.logoUrl.set(null);
    this.showModal = true;
  }

  onEdit(company: ICompany): void {
    this.isEdit.set(true);
    this.editId = company.id;
    this.form = {
      name: company.name,
      taxId: company.taxId,
      maxUsers: company.maxUsers,
      maxConcurrentSessions: company.maxConcurrentSessions,
      subscriptionExpiresAt: company.subscriptionExpiresAt
        ? company.subscriptionExpiresAt.substring(0, 10)
        : null,
      colorPreset: company.colorPreset ?? DEFAULT_PRESET_ID,
      address: company.address ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      instagram: company.instagram ?? '',
      facebook: company.facebook ?? '',
      tikTok: company.tikTok ?? '',
      whatsApp: company.whatsApp ?? ''
    };
    this.logoUrl.set(this.companiesService.getLogoUrl(company.logoPath));
    this.showModal = true;
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo si se cancela/reintenta
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      this.notify.warn('El logo debe ser PNG, JPEG, WEBP o GIF');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.notify.warn('El logo no puede pesar más de 2 MB');
      return;
    }

    this.uploadingLogo.set(true);
    this.companiesService.uploadLogo(this.editId, file).subscribe({
      next: (response) => {
        this.uploadingLogo.set(false);
        this.logoUrl.set(this.companiesService.getLogoUrl(response.logoPath));
        this.notify.success('Logo actualizado');
        this.loadCompanies();
      },
      error: (e) => { this.uploadingLogo.set(false); this.notify.httpError(e); }
    });
  }

  onSave(): void {
    if (!this.form.name || !this.form.taxId) {
      this.notify.warn('Nombre y RFC son obligatorios');
      return;
    }
    if (this.form.email && !EMAIL_PATTERN.test(this.form.email)) {
      this.notify.warn('El email no tiene un formato válido');
      return;
    }

    const website = this.normalizeWebsite(this.form.website);
    if (this.form.website && !website) {
      this.notify.warn('El sitio web no tiene un formato válido');
      return;
    }
    const instagram = this.normalizeWebsite(this.form.instagram);
    if (this.form.instagram && !instagram) {
      this.notify.warn('El link de Instagram no tiene un formato válido');
      return;
    }
    const facebook = this.normalizeWebsite(this.form.facebook);
    if (this.form.facebook && !facebook) {
      this.notify.warn('El link de Facebook no tiene un formato válido');
      return;
    }
    const tikTok = this.normalizeWebsite(this.form.tikTok);
    if (this.form.tikTok && !tikTok) {
      this.notify.warn('El link de TikTok no tiene un formato válido');
      return;
    }

    const request: ICompanyRequest = {
      name: this.form.name,
      taxId: this.form.taxId,
      maxUsers: this.form.maxUsers,
      maxConcurrentSessions: this.form.maxConcurrentSessions,
      subscriptionExpiresAt: this.form.subscriptionExpiresAt
        ? new Date(`${this.form.subscriptionExpiresAt}T00:00:00Z`).toISOString()
        : null,
      colorPreset: this.form.colorPreset,
      address: this.form.address || null,
      phone: this.form.phone || null,
      email: this.form.email || null,
      website: website || null,
      instagram: instagram || null,
      facebook: facebook || null,
      tikTok: tikTok || null,
      whatsApp: this.form.whatsApp || null
    };

    this.saving.set(true);
    const obs = this.isEdit()
      ? this.companiesService.update(this.editId, request)
      : this.companiesService.create(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal = false;
        this.notify.success(this.isEdit() ? 'Empresa actualizada' : 'Empresa creada');
        this.loadCompanies();
      },
      error: (e) => { this.saving.set(false); this.notify.httpError(e); }
    });
  }

  /** Clase visual según qué tan cerca está el uso actual del límite del plan (null = sin límite, nunca alerta) */
  usageClass(current: number, max: number | null): string {
    if (max === null || max === 0) return '';
    const ratio = current / max;
    if (ratio >= 1) return 'danger';
    if (ratio >= 0.8) return 'warn';
    return '';
  }

  onDeactivate(company: ICompany): void {
    this.confirmService.confirm({
      message: `¿Desactivar la empresa "${company.name}"? Se bloqueará el acceso a todos sus usuarios.`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.companiesService.deactivate(company.id).subscribe({
          next: () => { this.notify.success('Empresa desactivada'); this.loadCompanies(); },
          error: (e) => this.notify.httpError(e)
        });
      }
    });
  }

  /** Agrega https:// si falta, y valida que quede una URL bien formada. Devuelve '' si es inválida. */
  private normalizeWebsite(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(withProtocol);
      return withProtocol;
    } catch {
      return '';
    }
  }
}
