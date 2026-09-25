import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreeTableModule } from 'primeng/treetable';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, TreeNode } from 'primeng/api';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NavRoutesService } from '../../services/nav-routes.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { AuthService } from '../../../../core/services/auth.service';
import { INavigationRoute, ICreateRouteRequest, IUpdateRouteRequest } from '../../../../core/models/navigation.models';
import { NotificationService } from '../../../../core/services/notification.service';

interface ParentOption { label: string; value: number | null; }

interface IRouteGroup {
  companyId: number;
  companyName: string;
  nodes: TreeNode[];
  search: string;
}

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TreeTableModule, ButtonModule, ConfirmDialogModule, DialogModule, HasPermissionDirective],
  providers: [ConfirmationService],
  templateUrl: './route-list.component.html',
  styleUrl: './route-list.component.scss'
})
export class RouteListComponent implements OnInit {
  private readonly service = inject(NavRoutesService);
  private readonly companiesService = inject(CompaniesService);
  private readonly notify = inject(NotificationService);
  private readonly confirmService = inject(ConfirmationService);
  readonly authService = inject(AuthService);

  private companyNames = new Map<number, string>();

  groups = signal<IRouteGroup[]>([]);
  loading = signal(true);
  showModal = false;
  isEdit = signal(false);
  saving = signal(false);
  editId = 0;
  editCompanyId: number | null = null;
  parentOptions = signal<ParentOption[]>([]);
  form = { parentId: null as number | null, windowName: '', routePath: '', icon: '', windowId: '', level: 0, sortOrder: 1, isActive: true };

  ngOnInit(): void {
    if (this.authService.isSystemAdmin()) {
      this.companiesService.getAll().subscribe({
        next: (companies) => {
          companies.forEach((c) => this.companyNames.set(c.id, c.name));
          this.loadTree();
        },
        error: () => this.loadTree()
      });
    } else {
      this.loadTree();
    }
  }

  loadTree(): void {
    this.loading.set(true);
    this.service.getTree().subscribe({
      next: (routes) => { this.groups.set(this.groupByCompany(routes)); this.loading.set(false); },
      error: () => { this.notify.error('No se pudo cargar el árbol'); this.loading.set(false); }
    });
  }

  /** Filtra el árbol de un grupo por su buscador local (nombre o ruta), conservando la jerarquía */
  filteredNodes(group: IRouteGroup): TreeNode[] {
    const term = group.search.trim().toLowerCase();
    if (!term) return group.nodes;
    return this.filterNodes(group.nodes, term);
  }

  private filterNodes(nodes: TreeNode[], term: string): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      const route = node.data as INavigationRoute;
      const matches =
        route.windowName.toLowerCase().includes(term) || route.routePath.toLowerCase().includes(term);
      const filteredChildren = node.children?.length ? this.filterNodes(node.children, term) : [];

      if (matches || filteredChildren.length) {
        result.push({
          ...node,
          expanded: true,
          children: filteredChildren.length ? filteredChildren : matches ? node.children : []
        });
      }
    }
    return result;
  }

  private groupByCompany(routes: INavigationRoute[]): IRouteGroup[] {
    const byCompany = new Map<number, INavigationRoute[]>();
    for (const route of routes) {
      const list = byCompany.get(route.companyId) ?? [];
      list.push(route);
      byCompany.set(route.companyId, list);
    }
    return [...byCompany.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([companyId, items]) => ({
        companyId,
        companyName: this.companyNames.get(companyId) ?? `Empresa #${companyId}`,
        nodes: this.mapToTreeNodes(items),
        search: ''
      }));
  }

  private mapToTreeNodes(routes: INavigationRoute[]): TreeNode[] {
    return routes.map((r) => ({
      data: r,
      expanded: true,
      children: r.children?.length ? this.mapToTreeNodes(r.children) : []
    }));
  }

  /** Opciones de "padre" limitadas a la misma empresa que la ruta que se está creando/editando */
  private loadParentOptions(companyId: number): void {
    this.service.getAll().subscribe({
      next: (routes) => {
        const opts: ParentOption[] = [{ label: '— Ninguno (raíz) —', value: null }];
        routes
          .filter((r) => r.id !== this.editId && r.companyId === companyId)
          .forEach((r) => opts.push({ label: `${r.windowName} (${r.routePath})`, value: r.id }));
        this.parentOptions.set(opts);
      }
    });
  }

  private resetForm(): void {
    this.form = { parentId: null, windowName: '', routePath: '', icon: '', windowId: '', level: 0, sortOrder: 1, isActive: true };
  }

  /** `companyId`: al crear desde el botón "+" de un grupo, preselecciona esa empresa (si no, cae en la del que llama) */
  onCreate(companyId?: number): void {
    this.resetForm();
    this.isEdit.set(false);
    this.editId = 0;
    this.editCompanyId = companyId ?? this.authService.currentUser()?.companyId ?? null;
    this.loadParentOptions(this.editCompanyId ?? 0);
    this.showModal = true;
  }

  companyName(companyId: number | null): string {
    if (!companyId) return '';
    return this.companyNames.get(companyId) ?? `Empresa #${companyId}`;
  }

  onEdit(route: INavigationRoute): void {
    this.isEdit.set(true);
    this.editId = route.id;
    this.editCompanyId = route.companyId;
    this.form = {
      parentId: route.parentId,
      windowName: route.windowName,
      routePath: route.routePath,
      icon: route.icon,
      windowId: route.windowId,
      level: route.level,
      sortOrder: route.sortOrder,
      isActive: route.isActive
    };
    this.loadParentOptions(route.companyId);
    this.showModal = true;
  }

  onSave(): void {
    if (!this.form.windowName || !this.form.routePath) { this.notify.warn('Nombre y ruta son obligatorios'); return; }
    this.saving.set(true);
    if (this.isEdit()) {
      this.service.update(this.editId, { ...this.form } as IUpdateRouteRequest).subscribe({ next: () => this.onSuccess('Ruta actualizada'), error: (e) => this.onError(e) });
    } else {
      const { isActive, ...rest } = this.form;
      const request: ICreateRouteRequest = this.authService.isSystemAdmin() && this.editCompanyId
        ? { ...rest, companyId: this.editCompanyId }
        : rest;
      this.service.create(request).subscribe({ next: () => this.onSuccess('Ruta creada'), error: (e) => this.onError(e) });
    }
  }

  private onSuccess(msg: string): void { this.saving.set(false); this.showModal = false; this.notify.success(msg); this.loadTree(); }
  private onError(err: unknown): void { this.saving.set(false); this.notify.httpError(err); }

  onDeactivate(route: INavigationRoute): void {
    this.confirmService.confirm({
      message: `¿Desactivar "${route.windowName}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'Cancelar',
      accept: () => {
        this.service.deactivate(route.id).subscribe({
          next: () => { this.notify.success('Ruta desactivada'); this.loadTree(); },
          error: () => this.notify.error('No se pudo desactivar')
        });
      }
    });
  }
}
