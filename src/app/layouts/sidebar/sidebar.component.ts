import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavigationService } from '../../core/services/navigation.service';
import { AuthService } from '../../core/services/auth.service';
import { INavigationRoute } from '../../core/models/navigation.models';

/** Bloque del panel flotante: rutas sueltas del apartado (sin título) o un subgrupo con su título */
interface IFlyoutSection {
  id: number;
  title: string | null;
  items: INavigationRoute[];
}

/** Posición del panel flotante: se ancla arriba (alineado al apartado) o abajo si no cabe */
interface IFlyoutPosition {
  left: number;
  top: number | null;
  bottom: number | null;
  maxHeight: number;
}

/** Espacio mínimo hacia abajo para anclar el panel arriba; si no hay, se ancla por abajo */
const FLYOUT_MIN_SPACE_BELOW = 320;
const FLYOUT_GAP = 8;
const VIEWPORT_MARGIN = 12;

/**
 * Menú lateral. Los apartados con rutas no se despliegan hacia abajo (el menú crecía demasiado con
 * todo abierto): al hacer clic abren un panel flotante a la derecha del sidebar con sus rutas. Un
 * tercer nivel se muestra dentro del mismo panel como sección con título, nunca como otro panel.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeFlyout(true)',
    '(window:resize)': 'closeFlyout()'
  }
})
export class SidebarComponent {
  readonly navService = inject(NavigationService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  collapsed = signal(false);

  /** Apartado cuyo panel flotante está abierto (null = ninguno) */
  openGroup = signal<INavigationRoute | null>(null);
  flyoutPosition = signal<IFlyoutPosition | null>(null);
  /** Elemento que abrió el panel, para regresarle el foco al cerrarlo con Esc */
  private flyoutTrigger: HTMLElement | null = null;

  /** Ruta actual (sin query params), para resaltar el item del menú correspondiente */
  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0])
    ),
    { initialValue: this.router.url.split('?')[0] }
  );

  /** Secciones del panel abierto: rutas directas agrupadas sin título, y cada subgrupo con el suyo */
  readonly flyoutSections = computed<IFlyoutSection[]>(() => {
    const group = this.openGroup();
    if (!group) return [];

    const sections: IFlyoutSection[] = [];
    let loose: IFlyoutSection | null = null;
    for (const child of group.children) {
      if (child.children.length === 0) {
        if (!loose) {
          loose = { id: -child.id, title: null, items: [] };
          sections.push(loose);
        }
        loose.items.push(child);
      } else {
        loose = null;
        sections.push({ id: child.id, title: child.windowName, items: this.leavesOf(child) });
      }
    }
    return sections;
  });

  isActive(item: INavigationRoute): boolean {
    return this.isNavigable(item) && item.routePath === this.currentPath();
  }

  /** Un apartado se marca activo si alguna de sus rutas (a cualquier nivel) es la actual */
  isGroupActive(item: INavigationRoute): boolean {
    const path = this.currentPath();
    return this.leavesOf(item).some((leaf) => leaf.routePath === path);
  }

  isNavigable(item: INavigationRoute): boolean {
    return item.routePath !== '#' && item.children.length === 0;
  }

  isOpen(item: INavigationRoute): boolean {
    return this.openGroup()?.id === item.id;
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
    this.closeFlyout();
  }

  /** Clic (o Enter/Espacio) en un item del primer nivel */
  onItemClick(item: INavigationRoute, event: Event): void {
    if (this.isNavigable(item)) {
      this.navigate(item);
      return;
    }
    if (this.isOpen(item)) {
      this.closeFlyout();
      return;
    }
    this.openFlyout(item, event.currentTarget as HTMLElement, event instanceof KeyboardEvent);
  }

  navigate(item: INavigationRoute): void {
    this.closeFlyout();
    this.router.navigate([item.routePath]);
  }

  closeFlyout(returnFocus = false): void {
    if (!this.openGroup()) return;
    this.openGroup.set(null);
    this.flyoutPosition.set(null);
    if (returnFocus) this.flyoutTrigger?.focus();
    this.flyoutTrigger = null;
  }

  /** Clic fuera del sidebar y del panel: cierra el panel */
  onDocumentClick(event: MouseEvent): void {
    if (this.openGroup() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeFlyout();
    }
  }

  /** Enter/Espacio sobre un item con role="button" (son `div`, no `button`, por el estilo del menú) */
  onItemKeydown(item: INavigationRoute, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.onItemClick(item, event);
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
    this.closeFlyout();
    this.navService.clear();
    this.authService.logout();
  }

  private openFlyout(item: INavigationRoute, trigger: HTMLElement, fromKeyboard: boolean): void {
    const itemRect = trigger.getBoundingClientRect();
    const sidebarRect = trigger.closest('aside')?.getBoundingClientRect() ?? itemRect;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - itemRect.top - VIEWPORT_MARGIN;
    const anchorTop = spaceBelow >= FLYOUT_MIN_SPACE_BELOW || itemRect.top < viewportHeight / 2;

    this.flyoutTrigger = trigger;
    this.flyoutPosition.set({
      left: sidebarRect.right + FLYOUT_GAP,
      top: anchorTop ? Math.max(itemRect.top, VIEWPORT_MARGIN) : null,
      bottom: anchorTop ? null : Math.max(viewportHeight - itemRect.bottom, VIEWPORT_MARGIN),
      maxHeight: anchorTop ? spaceBelow : itemRect.bottom - VIEWPORT_MARGIN
    });
    this.openGroup.set(item);

    // Con teclado, el foco pasa a la primera ruta del panel (con mouse no se mueve)
    if (fromKeyboard) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.flyout-link')?.focus());
    }
  }

  /** Todas las rutas navegables debajo de un item, a cualquier profundidad */
  private leavesOf(item: INavigationRoute): INavigationRoute[] {
    if (item.children.length === 0) return this.isNavigable(item) ? [item] : [];
    return item.children.flatMap((child) => this.leavesOf(child));
  }
}
