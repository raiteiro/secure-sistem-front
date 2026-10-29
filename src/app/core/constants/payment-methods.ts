import { PaymentMethod } from '../models/sale.models';

/** Etiquetas en español de cada método de pago — usado en POS, devoluciones y corte de caja. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Efectivo',
  Debit: 'Tarjeta de débito',
  Credit: 'Tarjeta de crédito',
  Transfer: 'Transferencia',
  Card: 'Tarjeta',
  Other: 'Otro'
};
