import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavigationService } from '../../core/services/navigation.service';
import { AuthService } from '../../core/services/auth.service';
import { INavigationRoute } from '../../core/models/navigation.models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  readonly navService = inject(NavigationService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  collapsed = signal(false);
  expandedIds = signal<Set<number>>(new Set());

  /** Ruta actual (sin query params), para resaltar el item del menú correspondiente */
  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0])
    ),
    { initialValue: this.router.url.split('?')[0] }
  );

  constructor() {
    // Al cargar el árbol o cambiar de ruta, despliega automáticamente el grupo que contiene la ruta activa
    effect(() => this.expandAncestorsOf(this.navService.routes(), this.currentPath()));
  }

  isActive(item: INavigationRoute): boolean {
    return this.isNavigable(item) && item.routePath === this.currentPath();
  }

  private expandAncestorsOf(routes: INavigationRoute[], path: string): void {
    const ancestorIds: number[] = [];

    const found = (items: INavigationRoute[], trail: number[]): boolean =>
      items.some((item) => {
        if (item.routePath === path) {
          ancestorIds.push(...trail);
          return true;
        }
        return item.children?.length ? found(item.children, [...trail, item.id]) : false;
      });

    found(routes, []);
    if (ancestorIds.length) {
      this.expandedIds.update((set) => new Set([...set, ...ancestorIds]));
    }
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }

  toggleExpand(item: INavigationRoute): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  isExpanded(item: INavigationRoute): boolean {
    return this.expandedIds().has(item.id);
  }

  isNavigable(item: INavigationRoute): boolean {
    return item.routePath !== '#' && item.children.length === 0;
  }

  onItemClick(item: INavigationRoute): void {
    if (this.isNavigable(item)) {
      this.router.navigate([item.routePath]);
    } else {
      this.toggleExpand(item);
    }
  }

  /** Devuelve la clase del icono. Usa FA directo si está disponible, sino PrimeIcons como fallback */
  mapIcon(icon: string): string {
    if (!icon) return 'pi pi-circle';
    if (icon.startsWith('fas ') || icon.startsWith('far ') || icon.startsWith('fab ')) {
      return icon;
    }
    return 'pi pi-circle';
  }

  logout(): void {
    this.navService.clear();
    this.authService.logout();
  }
}
