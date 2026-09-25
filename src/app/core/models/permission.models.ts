/**
 * Respuesta de GET /api/Permissions (catálogo global) y de GET /api/Roles/{id}/permissions
 * (los ya asignados a ese rol). Verificado contra la respuesta real.
 */
export interface IPermission {
  id: number;
  key: string;
  /** Nombre listo para mostrar, ya en español (ej. "Crear ruta") — fuente de verdad, no traducir en frontend */
  name: string;
  description: string | null;
  /** Vincula el permiso a su ventana — mismo valor que NavigationRoute.windowId (ej. "win-routes") */
  windowId: string;
  isActive: boolean;
  isDefaultForNewRoles: boolean;
}

/** Body de POST /api/Roles/{id}/permissions: reemplazo completo por lista de ids (mismo patrón que /routes) */
export interface IAssignPermissionsRequest {
  permissionIds: number[];
}
