/** Respuesta de GET /api/Customers y /api/Customers/{id} */
export interface ICustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  companyId: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  modifiedAt: string | null;
  modifiedBy: string | null;
}

/** Body para POST /api/Customers y POST /api/Customers/{id}/update. Todo salvo name es opcional. */
export interface ICustomerRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  /** Solo admin de sistema: crea el cliente en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}
