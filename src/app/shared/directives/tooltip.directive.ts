import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tooltip homologado del proyecto — reemplazo del `title` nativo del navegador (lento en
 * aparecer, feo, sin control de estilo). Uso: `[appTooltip]="'Texto'"`, opcionalmente
 * `[appTooltipPosition]="'bottom'"` (default `'top'`). Nunca combinar con `title` en el mismo
 * elemento (se verían los dos tooltips encimados) — si el elemento no tiene ya un `aria-label`
 * propio, agregar uno con el mismo texto para accesibilidad, ya que este tooltip es solo visual.
 *
 * La burbuja se inserta en `document.body` (no como hijo del elemento) por la misma razón que
 * `SearchableSelectComponent`/`MultiSelectComponent`: así nunca la recorta el `overflow:hidden`/
 * `overflow-x:auto` de un contenedor padre (ej. una tabla con scroll horizontal). Estilos en
 * `styles.scss` global bajo `.app-tooltip` — ver CLAUDE.md "Tooltips" antes de estilizarla distinto
 * en un componente, o de volver a usar `title` en vez de esta directiva.
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';
  @Input() appTooltipPosition: TooltipPosition = 'top';

  private readonly host = inject(ElementRef<HTMLElement>);
  private bubble: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter')
  @HostListener('focus')
  onShow(): void {
    if (!this.text) return;
    this.clearTimeout();
    this.showTimeout = setTimeout(() => this.attach(), 300);
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  @HostListener('click')
  onHide(): void {
    this.clearTimeout();
    this.detach();
  }

  // Reposicionar mientras está visible sería más código (y casi nunca pasa un scroll/resize
  // con el mouse quieto encima); más simple y suficiente: ocultar, que vuelva a aparecer si
  // el usuario sigue con el mouse encima.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onReposition(): void {
    this.detach();
  }

  private clearTimeout(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  private attach(): void {
    if (this.bubble || !this.text) return;
    const bubble = document.createElement('div');
    bubble.className = 'app-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = this.text;
    document.body.appendChild(bubble);
    this.bubble = bubble;
    this.position();
  }

  private position(): void {
    if (!this.bubble) return;
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const bubbleRect = this.bubble.getBoundingClientRect();
    const gap = 8;
    let top = 0;
    let left = 0;

    switch (this.appTooltipPosition) {
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + hostRect.width / 2 - bubbleRect.width / 2;
        break;
      case 'left':
        top = hostRect.top + hostRect.height / 2 - bubbleRect.height / 2;
        left = hostRect.left - bubbleRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + hostRect.height / 2 - bubbleRect.height / 2;
        left = hostRect.right + gap;
        break;
      default:
        top = hostRect.top - bubbleRect.height - gap;
        left = hostRect.left + hostRect.width / 2 - bubbleRect.width / 2;
    }

    // No se deja que se salga de los lados de la ventana
    left = Math.max(4, Math.min(left, window.innerWidth - bubbleRect.width - 4));

    this.bubble.style.top = `${top}px`;
    this.bubble.style.left = `${left}px`;
    this.bubble.setAttribute('data-position', this.appTooltipPosition);
  }

  private detach(): void {
    this.bubble?.remove();
    this.bubble = null;
  }

  ngOnDestroy(): void {
    this.clearTimeout();
    this.detach();
  }
}
