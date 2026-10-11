/**
 * Unidad de medida del catálogo global (lo administra el admin de sistema, es el mismo para todas
 * las empresas). `decimalPlaces` decide qué cantidades acepta cualquier producto con esta unidad:
 * 0 = solo enteros (pieza), 2 = hasta centésimos (metro → centímetros), 3 = hasta milésimos (kg → g).
 */
export interface IUnitOfMeasure {
  id: number;
  name: string;
  abbreviation: string;
  /** 0 a 4 */
  decimalPlaces: number;
  isActive: boolean;
  /** Cuántos productos activos usan la unidad (el backend no deja bajar decimales si es > 0) */
  productCount: number;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body de POST /api/UnitsOfMeasure y POST /api/UnitsOfMeasure/{id}/update (solo admin de sistema) */
export interface IUnitOfMeasureRequest {
  name: string;
  abbreviation: string;
  decimalPlaces: number;
}
