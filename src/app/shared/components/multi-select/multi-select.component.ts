import { Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ISelectOption } from '../searchable-select/searchable-select.component';

/**
 * Select múltiple con checkbox por opción — mismo trigger+panel portal que
 * `SearchableSelectComponent` (ver su doc comment para el por qué del portal a
 * `document.body`), pero el valor es un arreglo y las opciones se van marcando/desmarcando
 * sin cerrar el panel. Implementa `ControlValueAccessor`, se usa igual que un select nativo
 * con `[(ngModel)]="algo"` donde `algo` es `number[]` (o el tipo de `ISelectOption.value`).
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true
    }
  ]
})
export class MultiSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: ISelectOption[] = [];
  /** Se muestra cuando no hay nada seleccionado */
  @Input() placeholder = 'Selecciona...';
  @Input() searchPlaceholder = 'Buscar...';
  @Input() emptyLabel = 'Sin resultados';

  @ViewChild('trigger', { static: true }) triggerRef!: ElementRef<HTMLElement>;
  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  readonly search = signal('');

  value: unknown[] = [];
  disabled = false;

  private onChange: (value: unknown[]) => void = () => {};
  private onTouched: () => void = () => {};
  private panelAttached = false;

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

  /** Lista los nombres si son pocos; si no, muestra el conteo */
  get selectedLabel(): string {
    if (this.value.length === 0) return '';
    const labels = this.options.filter((o) => this.value.includes(o.value)).map((o) => o.label);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.length} seleccionados`;
  }

  isSelected(option: ISelectOption): boolean {
    return this.value.includes(option.value);
  }

  writeValue(value: unknown[]): void {
    this.value = value ?? [];
  }

  registerOnChange(fn: (value: unknown[]) => void): void {
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
    this.open.set(true);
    this.onTouched();
    setTimeout(() => {
      this.attachPanel();
      this.position();
      this.panelRef?.nativeElement.querySelector('input')?.focus();
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

  toggleOption(option: ISelectOption): void {
    if (option.disabled) return;
    const next = this.isSelected(option)
      ? this.value.filter((v) => v !== option.value)
      : [...this.value, option.value];
    this.value = next;
    this.onChange(next);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
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
