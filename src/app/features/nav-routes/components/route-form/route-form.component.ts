import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { NavRoutesService } from '../../services/nav-routes.service';
import { INavigationRoute, ICreateRouteRequest, IUpdateRouteRequest } from '../../../../core/models/navigation.models';

interface ParentOption { label: string; value: number | null; }

@Component({
  selector: 'app-route-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, InputTextModule, InputNumberModule,
    ButtonModule, DropdownModule, InputSwitchModule, ToastModule
  ],
  providers: [MessageService],
  templateUrl: './route-form.component.html',
  styleUrl: './route-form.component.scss'
})
export class RouteFormComponent implements OnInit {
  private readonly service = inject(NavRoutesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  isEdit = signal(false);
  loading = signal(false);
  routeId = 0;

  form = {
    parentId: null as number | null,
    windowName: '',
    routePath: '',
    icon: '',
    windowId: '',
    level: 0,
    sortOrder: 1,
    isActive: true
  };

  parentOptions = signal<ParentOption[]>([]);

  ngOnInit(): void {
    this.loadParentOptions();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.routeId = +id;
      this.loadRoute();
    }
  }

  private loadParentOptions(): void {
    this.service.getAll().subscribe({
      next: (routes) => {
        const opts: ParentOption[] = [{ label: '— Ninguno (raíz) —', value: null }];
        routes.forEach((r) => opts.push({ label: `${r.windowName} (${r.routePath})`, value: r.id }));
        this.parentOptions.set(opts);
      }
    });
  }

  private loadRoute(): void {
    this.loading.set(true);
    this.service.getById(this.routeId).subscribe({
      next: (r) => {
        this.form.parentId = r.parentId;
        this.form.windowName = r.windowName;
        this.form.routePath = r.routePath;
        this.form.icon = r.icon;
        this.form.windowId = r.windowId;
        this.form.level = r.level;
        this.form.sortOrder = r.sortOrder;
        this.form.isActive = r.isActive;
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la ruta' });
        this.loading.set(false);
      }
    });
  }

  onSave(): void {
    if (!this.form.windowName || !this.form.routePath) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Nombre y ruta son obligatorios' });
      return;
    }

    this.loading.set(true);

    if (this.isEdit()) {
      const body: IUpdateRouteRequest = { ...this.form };
      this.service.update(this.routeId, body).subscribe({
        next: () => this.onSuccess('Ruta actualizada'),
        error: (err) => this.onError(err)
      });
    } else {
      const { isActive, ...rest } = this.form;
      const body: ICreateRouteRequest = rest;
      this.service.create(body).subscribe({
        next: () => this.onSuccess('Ruta creada'),
        error: (err) => this.onError(err)
      });
    }
  }

  private onSuccess(msg: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: msg });
    setTimeout(() => this.router.navigate(['/admin/routes']), 1000);
  }

  private onError(err: unknown): void {
    this.loading.set(false);
    const detail = (err as { error?: { message?: string } })?.error?.message ?? 'Ocurrió un error';
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }

  onCancel(): void {
    this.router.navigate(['/admin/routes']);
  }
}
