export interface IRole {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  routeIds: number[];
  companyId?: number;
}

export interface ICreateRoleRequest {
  name: string;
  description: string;
  /** Solo admin de sistema: crea el rol en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}

export interface IUpdateRoleRequest {
  name: string;
  description: string;
}

export interface IAssignRoutesRequest {
  routeIds: number[];
}
