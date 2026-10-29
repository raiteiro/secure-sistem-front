import { IPageFilters } from './pagination.models';

/** Body de POST /api/StockTransfers: mueve stock de un producto entre dos almacenes de la misma empresa */
export interface ICreateStockTransferRequest {
  productId: number;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  /** Fraccionaria, como cualquier otra cantidad de inventario */
  quantity: number;
  notes?: string | null;
}

/** Respuesta de POST /api/StockTransfers, GET /api/StockTransfers y GET /api/StockTransfers/{id} */
export interface IStockTransfer {
  id: number;
  folioNumber: number;
  productId: number;
  productName: string;
  productSku: string | null;
  productUnitAbbreviation: string;
  productUnitDecimalPlaces: number;
  sourceWarehouseId: number;
  sourceWarehouseName: string;
  destinationWarehouseId: number;
  destinationWarehouseName: string;
  quantity: number;
  notes: string | null;
  userId: number;
  username: string;
  companyId: number;
  createdAt: string;
  createdBy: string;
}

/** Query params opcionales de GET /api/StockTransfers. warehouseId matchea origen o destino */
export interface IStockTransferFilters extends IPageFilters {
  warehouseId?: number;
  productId?: number;
  from?: string;
  to?: string;
}
