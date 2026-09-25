/** Query params comunes de paginación. `pageSize` se recorta solo del lado del backend a 100 */
export interface IPageFilters {
  page?: number;
  pageSize?: number;
}

/** Sobre de respuesta paginada — reemplaza el `T[]` plano en los endpoints que ya migraron */
export interface IPagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
