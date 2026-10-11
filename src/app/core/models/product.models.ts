/** Respuesta de GET /api/Products y /api/Products/{id} */
export interface IProduct {
  id: number;
  sku: string | null;
  name: string;
  description: string | null;
  /** Unidad de medida del catálogo global (ver `IUnitOfMeasure`) — decide qué cantidades acepta */
  unitId: number;
  unitName: string;
  unitAbbreviation: string;
  /** Decimales que admite la unidad: 0 = solo enteros */
  unitDecimalPlaces: number;
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
  /** "Supply" = insumo: no se vende, se consume al fabricar. Exclusivo: nunca es las dos cosas */
  kind: ProductKind;
  /** Producto con receta de insumos que se fabrica en almacén (ver /recipe y /api/Production). Siempre kind="Product" */
  isManufactured: boolean;
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

export type ProductKind = 'Product' | 'Supply';

/** `Percentage`: commissionValue es lo que se queda la tienda (ej. 30 = tienda 30%, consignador 70%). `FixedAmount`: lo que se le paga al consignador por unidad, sin importar el precio */
export type CommissionType = 'Percentage' | 'FixedAmount';

/** Body para POST /api/Products y POST /api/Products/{id}/update */
export interface IProductRequest {
  /** Opcional, pero único por empresa mientras el producto esté activo si se manda */
  sku?: string | null;
  name: string;
  description?: string | null;
  /** Unidad activa del catálogo global. Obligatoria */
  unitId: number;
  price: number;
  cost?: number | null;
  /** Si se manda, debe pertenecer a la misma empresa del producto */
  categoryId?: number | null;
  /** Si se manda, debe pertenecer a la misma empresa del producto */
  taxRateId?: number | null;
  /** Solo admin de sistema: crea el producto en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
  isCombo: boolean;
  /**
   * Al crear, default "Product". Al editar es opcional: si se omite, el tipo se queda como estaba.
   * Un insumo no puede ser combo ni tener proveedor consignador.
   */
  kind?: ProductKind;
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

/** Respuesta de GET /api/Products/{id}/recipe: cantidad de cada insumo por 1 unidad del producto fabricado */
export interface IRecipeItem {
  supplyProductId: number;
  supplyProductName: string;
  supplyProductSku: string | null;
  /** Abreviatura de la unidad del insumo */
  supplyUnit: string | null;
  supplyUnitDecimalPlaces: number;
  quantity: number;
}

/** Línea de receta en los bodies: el insumo debe ser kind="Supply", activo y de la misma empresa; sin repetidos */
export interface IRecipeItemRequest {
  supplyProductId: number;
  quantity: number;
}

/** Body de POST /api/Products/{id}/recipe: reemplaza la receta completa (mínimo una línea) */
export interface IAssignRecipeRequest {
  items: IRecipeItemRequest[];
}

/**
 * Body de POST /api/Products/manufactured: alta de un producto fabricado junto con su receta, en una
 * transacción. Siempre kind="Product", no combo, sin proveedor.
 */
export interface IManufacturedProductRequest {
  sku?: string | null;
  name: string;
  description?: string | null;
  /** Unidad activa del catálogo global. Obligatoria */
  unitId: number;
  price: number;
  cost?: number | null;
  categoryId?: number | null;
  taxRateId?: number | null;
  /** Solo admin de sistema: crea el producto en otra empresa */
  companyId?: number | null;
  recipe: IRecipeItemRequest[];
}
