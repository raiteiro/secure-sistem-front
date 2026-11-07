import { Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ISelectOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Reemplazo de `<select>` nativo con buscador integrado, para selects con muchas opciones
 * (producto, cliente, etc.). Implementa `ControlValueAccessor` para usarse exactamente igual que un
 * select nativo con `[(ngModel)]`. El panel de opciones se despega del DOM y se reinserta en
 * `document.body` al abrirse (mismo motivo que el resto de los overlays de PrimeNG en este proyecto,
 * ver CLAUDE.md "Regla general para componentes PrimeNG que se renderizan como portal"): los
 * `p-dialog` centran con `transform`, que crea su propio contenedor de posicionamiento para
 * cualquier descendiente — con eso, un panel `position: fixed` quedaría igual recortado por el
 * `overflow-y: auto` de `.rm-body` en formularios largos si no se saca físicamente del árbol.
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: ISelectOption[] = [];
  @Input() placeholder = 'Selecciona...';
  @Input() searchPlaceholder = 'Buscar...';
  @Input() emptyLabel = 'Sin resultados';

  @ViewChild('trigger', { static: true }) triggerRef!: ElementRef<HTMLElement>;
  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  readonly search = signal('');
  readonly activeIndex = signal(0);

  value: unknown = null;
  disabled = false;

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};
  private panelAttached = false;

  /** Cierra al hacer scroll fuera del panel (dentro del panel, `.ss-options` scrollea su propia lista) */
  private readonly closeOnScroll = (event: Event): void => {
    const panel = this.panelRef?.nativeElement;
    if (panel && event.target instanceof Node && panel.contains(event.target)) return;
    this.close();
  };
  private readonly closeOnResize = (): void => this.close();

  get filteredOptions(): ISelectOption[] {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(term));
  }

  get selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? '';
  }

  writeValue(value: unknown): void {
    this.value = value;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.close();
  }

  toggle(): void {
    if (this.disabled) return;
    if (this.open()) this.close();
    else this.openPanel();
  }

  openPanel(): void {
    this.search.set('');
    const currentIndex = this.options.findIndex((o) => o.value === this.value);
    this.activeIndex.set(Math.max(0, currentIndex));
    this.open.set(true);
    this.onTouched();
    // Esperar al siguiente tick para que Angular pinte `.ss-panel` antes de medirlo/moverlo
    setTimeout(() => {
      this.attachPanel();
      this.position();
      this.panelRef?.nativeElement.querySelector('input')?.focus();
      this.scrollActiveIntoView();
    });
    window.addEventListener('scroll', this.closeOnScroll, true);
    window.addEventListener('resize', this.closeOnResize);
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.detachPanel();
    window.removeEventListener('scroll', this.closeOnScroll, true);
    window.removeEventListener('resize', this.closeOnResize);
  }

  selectOption(option: ISelectOption): void {
    if (option.disabled) return;
    this.value = option.value;
    this.onChange(this.value);
    this.close();
    this.triggerRef.nativeElement.focus();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.activeIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set(Math.min(this.activeIndex() + 1, opts.length - 1));
      this.scrollActiveIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = opts[this.activeIndex()];
      if (active) this.selectOption(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.triggerRef.nativeElement.focus();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    } else if (event.key === 'ArrowDown' && !this.open()) {
      event.preventDefault();
      this.openPanel();
    }
  }

  private scrollActiveIntoView(): void {
    const panel = this.panelRef?.nativeElement;
    const activeEl = panel?.querySelector('.ss-option.active') as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    const insideTrigger = this.triggerRef.nativeElement.contains(target);
    const insidePanel = this.panelRef?.nativeElement.contains(target) ?? false;
    if (!insideTrigger && !insidePanel) this.close();
  }

  private attachPanel(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel || this.panelAttached) return;
    document.body.appendChild(panel);
    this.panelAttached = true;
  }

  private detachPanel(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel || !this.panelAttached) return;
    panel.remove();
    this.panelAttached = false;
  }

  /** Reposiciona el panel (ya en `document.body`) respecto al trigger; abre hacia arriba si no cabe abajo */
  private position(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const rect = this.triggerRef.nativeElement.getBoundingClientRect();
    const panelHeight = panel.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < panelHeight && rect.top > spaceBelow;

    panel.style.position = 'fixed';
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    if (openUpward) {
      panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      panel.style.top = 'auto';
    } else {
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.bottom = 'auto';
    }
    panel.style.visibility = 'visible';
  }

  ngOnDestroy(): void {
    this.detachPanel();
    window.removeEventListener('scroll', this.closeOnScroll, true);
    window.removeEventListener('resize', this.closeOnResize);
  }
}
