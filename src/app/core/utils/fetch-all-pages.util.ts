import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { IPagedResult } from '../models/pagination.models';

/** Tamaño de página máximo que acepta el backend (`PaginationHelper.MaxPageSize`) */
export const MAX_PAGE_SIZE = 100;

/**
 * Recorre todas las páginas de un endpoint paginado y devuelve los `items` concatenados.
 * Pensado para catálogos que la pantalla necesita completos (selectores, POS, agrupaciones en cliente);
 * las tablas transaccionales deben paginar de verdad con `<app-pager>` en vez de usar esto.
 * `fetchPage` recibe el número de página (1-based) y debe pedirla con `pageSize: MAX_PAGE_SIZE`.
 */
export function fetchAllPages<T>(fetchPage: (page: number) => Observable<IPagedResult<T>>): Observable<T[]> {
  return fetchPage(1).pipe(
    expand((result) => (result.page < result.totalPages ? fetchPage(result.page + 1) : EMPTY)),
    map((result) => result.items),
    reduce((all, items) => all.concat(items), [] as T[])
  );
}
