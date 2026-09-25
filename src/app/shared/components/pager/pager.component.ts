import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Controles de paginación reutilizables para listas que consumen un `IPagedResult<T>` del backend.
 * Standalone y sin dependencias de ninguna feature — pensado para usarse en cualquier sistema derivado.
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pager.component.html',
  styleUrl: './pager.component.scss'
})
export class PagerComponent {
  /** Página actual (1-based) */
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() totalCount = 0;
  @Input() pageSize = 25;

  @Output() pageChange = new EventEmitter<number>();

  get rangeStart(): number {
    return this.totalCount === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  onPrev(): void {
    if (this.page > 1) this.pageChange.emit(this.page - 1);
  }

  onNext(): void {
    if (this.page < this.totalPages) this.pageChange.emit(this.page + 1);
  }
}
