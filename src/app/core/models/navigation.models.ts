export interface INavigationRoute {
  id: number;
  parentId: number | null;
  windowName: string;
  routePath: string;
  icon: string;
  windowId: string;
  level: number;
  sortOrder: number;
  companyId: number;
  isActive: boolean;
  children: INavigationRoute[];
}

export interface ICreateRouteRequest {
  parentId: number | null;
  windowName: string;
  routePath: string;
  icon: string;
  windowId: string;
  level: number;
  sortOrder: number;
  /** Solo admin de sistema: crea la ruta en otra empresa. Si se omite, usa la empresa del que llama. */
  companyId?: number;
}

export interface IUpdateRouteRequest {
  parentId: number | null;
  windowName: string;
  routePath: string;
  icon: string;
  windowId: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
}
