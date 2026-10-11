import { InventoryMovementType, ManualInventoryMovementType } from '../models/inventory.models';

/** Etiqueta en español de cada tipo de movimiento, para historiales */
export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  In: 'Entrada',
  Out: 'Salida',
  Adjustment: 'Ajuste',
  Purchase: 'Compra',
  Sale: 'Venta',
  Return: 'Devolución',
  Production: 'Producción',
  Disassembly: 'Separación'
};

/**
 * Arma el `quantity` con el signo que exige el backend según `type`:
 * - In/Purchase/Return: siempre positiva
 * - Out/Sale: siempre negativa
 * - Adjustment: el signo lo decide `direction` (increase/decrease)
 * `magnitude` siempre se captura como positivo en el formulario — aquí se le aplica el signo correcto.
 */
export function signedMovementQuantity(
  type: ManualInventoryMovementType,
  magnitude: number,
  direction: 'increase' | 'decrease'
): number {
  if (type === 'In' || type === 'Purchase' || type === 'Return') return magnitude;
  if (type === 'Out' || type === 'Sale') return -magnitude;
  return direction === 'decrease' ? -magnitude : magnitude;
}
