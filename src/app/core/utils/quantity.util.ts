/**
 * Reglas de cantidad según la unidad de medida del producto (`decimalPlaces` de su unidad). Es la
 * misma regla que valida el backend en ventas, devoluciones, movimientos, recetas, combos y
 * producción: la cantidad no puede tener más decimales que los que permite la unidad.
 */

/** Tope de decimales que acepta el sistema (las columnas de cantidad son decimal(18,4)) */
export const MAX_QUANTITY_DECIMALS = 4;

/** Decimales a usar cuando el dato de la unidad no viene (respuestas viejas): no restringe */
const FALLBACK_DECIMALS = MAX_QUANTITY_DECIMALS;

function normalizeDecimals(decimalPlaces: number | null | undefined): number {
  if (decimalPlaces === null || decimalPlaces === undefined || decimalPlaces < 0) return FALLBACK_DECIMALS;
  return Math.min(Math.floor(decimalPlaces), MAX_QUANTITY_DECIMALS);
}

/** Valor para el atributo `step` de un `<input type="number">`: 1, 0.1, 0.01, 0.001... */
export function quantityStep(decimalPlaces: number | null | undefined): number {
  return 1 / 10 ** normalizeDecimals(decimalPlaces);
}

/** Formato para el pipe `number` (ej. '1.0-2'): nunca muestra más decimales de los que admite la unidad */
export function quantityFormat(decimalPlaces: number | null | undefined): string {
  return `1.0-${normalizeDecimals(decimalPlaces)}`;
}

/** true si `quantity` no tiene más decimales de los permitidos (tolera el ruido de punto flotante) */
export function hasAllowedDecimals(quantity: number, decimalPlaces: number | null | undefined): boolean {
  const factor = 10 ** normalizeDecimals(decimalPlaces);
  const scaled = quantity * factor;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Recorta (hacia abajo) a los decimales permitidos — para topes calculados, ej. stock disponible */
export function floorToAllowedDecimals(quantity: number, decimalPlaces: number | null | undefined): number {
  const factor = 10 ** normalizeDecimals(decimalPlaces);
  return Math.floor(quantity * factor + 1e-6) / factor;
}

/**
 * Mensaje de error en español si la cantidad no respeta la unidad, o null si está bien.
 * `productName` y `unitName` son para el texto, ej. "'Cable' se maneja en Metro con máximo 2 decimales."
 */
export function quantityDecimalsError(
  quantity: number,
  decimalPlaces: number | null | undefined,
  productName: string,
  unitName?: string | null
): string | null {
  if (hasAllowedDecimals(quantity, decimalPlaces)) return null;
  const decimals = normalizeDecimals(decimalPlaces);
  const unit = unitName ? ` en ${unitName}` : '';
  return decimals === 0
    ? `"${productName}" se maneja${unit} solo en cantidades enteras.`
    : `"${productName}" se maneja${unit} con máximo ${decimals} decimal${decimals === 1 ? '' : 'es'}.`;
}
