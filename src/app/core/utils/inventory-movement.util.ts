import { InventoryMovementType } from '../models/inventory.models';

/**
 * Arma el `quantity` con el signo que exige el backend según `type`:
 * - In/Purchase/Return: siempre positiva
 * - Out/Sale: siempre negativa
 * - Adjustment: el signo lo decide `direction` (increase/decrease)
 * `magnitude` siempre se captura como positivo en el formulario — aquí se le aplica el signo correcto.
 */
export function signedMovementQuantity(
  type: InventoryMovementType,
  magnitude: number,
  direction: 'increase' | 'decrease'
): number {
  if (type === 'In' || type === 'Purchase' || type === 'Return') return magnitude;
  if (type === 'Out' || type === 'Sale') return -magnitude;
  return direction === 'decrease' ? -magnitude : magnitude;
}
