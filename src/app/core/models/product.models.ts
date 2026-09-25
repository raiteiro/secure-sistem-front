/** Respuesta de GET /api/Products y /api/Products/{id} */
export interface IProduct {
  id: number;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  /** Precio de venta unitario, sin impuesto */
  price: number;
  cost: number | null;
  imagePath: string | null;
  categoryId: number | null;
  categoryName: string | null;
  /** null si el producto no tiene impuesto asignado */
  taxRateId: number | null;
  taxRateName: string | null;
  /** Fracción (0 a 1), ya resuelta — no hace falta cruzar con TaxRates */
  taxRateValue: number | null;
  companyId: number;
  isActive: boolean;
  /** Si es true, el producto es un combo/kit — sus componentes se manejan vía /combo-items */
  isCombo: boolean;
  /** null si el producto no tiene proveedor asignado */
  supplierId: number | null;
  supplierName: string | null;
  /** Resuelto por el backend, evita cruzar con /api/suppliers para saber si aplica comisión */
  supplierIsConsignor: boolean;
  /** Solo aplica (no-null) si supplierId apunta a un proveedor con isConsignor=true */
  commissionType: CommissionType | null;
  /** Porcentaje (ej. 30 = tienda se queda 30%) si commissionType es Percentage, o monto fijo por unidad si es FixedAmount */
  commissionValue: number | null;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** `Percentage`: commissionValue es lo que se queda la tienda (ej. 30 = tienda 30%, consignador 70%). `FixedAmount`: lo que se le paga al consignador por unidad, sin importar el precio */
export type CommissionType = 'Percentage' | 'FixedAmount';

/** Body para POST /api/Products y POST /api/Products/{id}/update */
export interface IProductRequest {
  /** Opcional, pero único por empresa mientras el producto esté activo si se manda */
  sku?: string | null;
  name: string;
  description?: string | null;
  unit?: string | null;
  price: number;
  cost?: number | null;
  /** Si se manda, debe pertenecer a la misma empresa del producto */
  categoryId?: number | null;
  /** Si se manda, debe pertenecer a la misma empresa del producto */
  taxRateId?: number | null;
  /** Solo admin de sistema: crea el producto en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
  isCombo: boolean;
  /** Si no apunta a un proveedor con isConsignor=true, commissionType/commissionValue se ignoran (quedan null) */
  supplierId?: number | null;
  commissionType?: CommissionType | null;
  commissionValue?: number | null;
}

/** Respuesta de POST /api/Products/{id}/image */
export interface IProductImageResponse {
  imagePath: string;
}

/** Respuesta de GET /api/Products/{id}/combo-items */
export interface IComboItem {
  componentProductId: number;
  componentProductName: string;
  componentProductSku: string | null;
  quantity: number;
}

/**
 * Body de POST /api/Products/{id}/combo-items: reemplaza todos los componentes del combo.
 * El producto debe tener isCombo=true, los componentes deben ser productos activos de la misma
 * empresa, no pueden ser a su vez combos (no hay combos anidados) ni incluirse a sí mismo.
 */
export interface IAssignComboItemsRequest {
  items: { componentProductId: number; quantity: number }[];
}
