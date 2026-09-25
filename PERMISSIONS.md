# Árbol de permisos por acción (botones)

Inventario de todas las ventanas del sistema y las acciones de negocio (botones) que exponen, con
un id alfanumérico por acción para que el backend las asigne a roles de forma granular (además del
permiso por ventana completa que ya existía vía `NavigationRoute` / `RoleListComponent.onManageRoutes`).

Generado a partir del código en `src/app/features` el 2026-09-16. Si se agregan pantallas o botones
nuevos, este archivo hay que actualizarlo a mano — no se genera automáticamente.

## Contrato con el backend (implementado)

El backend sembró estos 47 ids en su catálogo (`Models/Permission.cs`, con `IsDefaultForNewRoles`
igual que `NavigationRoute`) y expone:

- `GET /api/Permissions` — catálogo completo (`{ id, key, name, description, windowId, isActive,
  isDefaultForNewRoles }`, verificado contra la respuesta real). `key` es el id de esta tabla, ej.
  `"SALES.CANCEL"`; `name` es el texto en español ya listo para mostrar (ej. "Cancelar venta");
  `windowId` es el mismo valor que `NavigationRoute.windowId` (ej. `"win-cashregisters"`) — es la
  llave que vincula el permiso con su ventana, **no** el texto de `windowName`.
- `GET /api/Permissions/my-permissions` — los `key` que tiene el usuario autenticado (`string[]`).
  System admin recibe el catálogo completo sin consultar roles.
- `GET /api/Roles/{id}/permissions` / `POST /api/Roles/{id}/permissions` — ver/asignar permisos de
  un rol, mismo patrón que `/routes` (reemplazo completo por lista de ids).

`PermissionsService` (`core/services/permissions.service.ts`) pide `my-permissions` una vez por
sesión al detectar usuario logueado y cachea el resultado; `has(id)` lo consulta. Mientras esa
llamada no ha resuelto, no oculta nada (evita parpadeo); `isSystemAdmin` sigue mandando por encima
de todo.

## Convención de ID

`MODULO.ACCION`, en mayúsculas, con `_` para separar palabras dentro de cada parte. El módulo es
estable por ventana (no cambia aunque cambie el texto del botón); la acción describe el efecto de
negocio, no el ícono ni la etiqueta.

**Todo lo que ve el usuario final va en español**, sin excepción — el `key` (`MODULO.ACCION`) es
solo un identificador técnico, nunca se muestra tal cual en una pantalla. El texto que se muestra
para cada acción es `IPermission.name`, tal cual lo manda el backend (ej. "Crear ruta", "Cancelar
venta") — el backend es la fuente de verdad para ese texto, el frontend no lo traduce ni lo
duplica. Al agregar un permiso nuevo, avisar al backend para que `name` quede en español desde el
alta (ver tabla más abajo, columna "Acción", para el texto exacto a usar).

## Qué cuenta como "acción" aquí

Solo botones que disparan una operación de negocio real contra el backend (crear, editar,
desactivar, exportar, abrir/cerrar turno, enviar correo, etc.). **No** se listan como acciones:

- Cerrar un modal (`rm-close`, la `x`) o su botón "Cancelar" — es navegación de UI, no de negocio.
- Cambiar de tab (ej. "Nueva venta" / "Historial" en Ventas) — es navegación, misma ventana.
- Paginación, ordenar tabla, expandir una fila (ej. el desglose de productos en Reportes).
- Filtros de solo lectura (selects de sucursal/usuario/fecha, el toggle "solo stock bajo").
- Botones de solo lectura tipo "Ver detalle" / "Ver historial" — ya cubiertos por el acceso a la
  ventana en sí (si no tienes acceso a la ventana, ni siquiera ves el botón).
- Las pantallas públicas/de sesión (`/login`, `/forgot-password`, `/reset-password`,
  `/change-password`) — no son parte del árbol de módulos de negocio, están disponibles para
  cualquier usuario autenticado (o sin autenticar) independientemente de su rol.
- `/dashboard` (`DashboardComponent`) y la ruta comodín `**` (`NotFoundComponent`) — no tienen
  ningún botón, solo texto.

## Notas de diseño para el frontend (cuando se conecte a permisos reales)

- **Crear y Editar comparten el mismo modal y el mismo botón "Guardar"** en casi todas las
  pantallas (`onSave()` decide internamente si crea o actualiza según `isEdit()`). Aun así son dos
  permisos distintos: el frontend debe ocultar el botón de entrada correspondiente por separado
  — el `+` "Nueva X" / `group-add-btn` para `CREATE`, el ícono de lápiz por fila para `EDIT` — y
  dejar que "Guardar" ejecute lo que corresponda según por cuál entró.
- `COMPANIES.UPLOAD_LOGO` no es un `<button>`, es un `<label>` que envuelve un `<input type="file"
  hidden>` (`onLogoFileSelected`). Cuenta igual como acción disparadora de un POST.
- El componente `src/app/features/nav-routes/components/route-form/` existe en el código pero no
  está enrutado ni se usa desde ningún otro componente (código muerto) — no aparece en el árbol.
- `ROLES.ASSIGN_ROUTES` (asigna ventanas completas, `RolesService.assignRoutes`) y
  `ROLES.ASSIGN_PERMISSIONS` (asigna estos ids de acción, `RolesService.assignPermissions`) viven en
  **un solo modal** ("Rutas y permisos", un solo botón — el ícono sitemap, gateado por
  `ROLES.ASSIGN_ROUTES`), no en pantallas separadas. Cada acción se muestra anidada justo debajo de
  la ruta/ventana a la que pertenece (`RoleListComponent.actionsFor(windowId)` hace el match por
  `windowId`, el mismo código en `IPermission.windowId` y en `INavigationRoute.windowId` — **no**
  por `windowName`, que es texto libre y no hay garantía de que calce). El bloque de acciones
  completo solo se pide y se muestra si el usuario logueado tiene `ROLES.ASSIGN_PERMISSIONS`
  (`canAssignPermissions()`) — si no lo tiene, ve y guarda solo rutas; el "Guardar" único llama a
  `assignRoutes` siempre y a `assignPermissions` solo si esa sección estaba visible, para no pegarle
  a un endpoint para el que no tiene permiso.
- **`SALES.CANCEL` es la única excepción a "ocultar el botón si no tienes el permiso"**: el botón de
  cancelar venta (`SalePosComponent`) se muestra a **todos**, tengan o no `SALES.CANCEL`. Si no lo
  tienen, `POST /Sales/{id}/cancel` responde 403 con `requiresSupervisorApproval: true` y el
  frontend abre un modal para que un supervisor con el permiso autorice con su usuario/contraseña
  (reintenta el mismo endpoint con esas credenciales en el body). Ocultar el botón habría hecho
  imposible llegar a ese flujo. Si se agrega otro botón con este mismo patrón de "autorización de
  supervisor", no gatearlo con `*appHasPermission` — dejarlo visible siempre y manejar el 403 con
  esa bandera en el componente.

---

## Árbol

```
Administración
├── Usuarios                         /admin/users            UserListComponent
│   ├── USERS.CREATE                 Nuevo usuario (+ variante "nuevo en esta empresa")
│   ├── USERS.EDIT                   Editar (ícono lápiz por fila)
│   ├── USERS.DEACTIVATE             Desactivar (ícono basura por fila)
│   ├── USERS.RESET_PASSWORD         Restablecer contraseña (ícono por fila)
│   └── USERS.REASSIGN_COMPANY       Cambiar de empresa (ícono por fila)
│
├── Rutas de Navegación              /admin/routes           RouteListComponent
│   ├── NAV_ROUTES.CREATE            Nueva ruta (+ variante "nueva en esta empresa")
│   ├── NAV_ROUTES.EDIT              Editar (ícono lápiz por fila)
│   └── NAV_ROUTES.DEACTIVATE        Desactivar (ícono basura por fila)
│
├── Roles                            /admin/roles             RoleListComponent
│   ├── ROLES.CREATE                 Nuevo rol (+ variante "nuevo en esta empresa")
│   ├── ROLES.EDIT                   Editar (ícono lápiz por fila)
│   ├── ROLES.DEACTIVATE             Desactivar (ícono basura por fila)
│   ├── ROLES.ASSIGN_ROUTES          Asignar rutas (ícono sitemap por fila)
│   └── ROLES.ASSIGN_PERMISSIONS     Asignar permisos (ícono check-square por fila)
│
└── Empresas                         /admin/empresas          CompanyListComponent
    ├── COMPANIES.CREATE             Nueva empresa
    ├── COMPANIES.EDIT               Editar (ícono lápiz por fila)
    ├── COMPANIES.DEACTIVATE         Desactivar (ícono basura por fila)
    └── COMPANIES.UPLOAD_LOGO        Subir/cambiar logo (dentro del modal de edición)

Catálogo
├── Sucursales                       /catalogo/sucursales     BranchListComponent
│   ├── BRANCHES.CREATE              Nueva sucursal (+ variante "nueva en esta empresa")
│   ├── BRANCHES.EDIT                Editar (ícono lápiz por fila)
│   └── BRANCHES.DEACTIVATE          Desactivar (ícono basura por fila)
│
├── Almacenes                        /catalogo/almacenes      WarehouseListComponent
│   ├── WAREHOUSES.CREATE            Nuevo almacén (+ variante "nuevo en esta empresa")
│   ├── WAREHOUSES.EDIT              Editar (ícono lápiz por fila)
│   ├── WAREHOUSES.DEACTIVATE        Desactivar (ícono basura por fila)
│   │
│   └── Detalle de almacén           /catalogo/almacenes/:id  WarehouseDetailComponent
│       ├── WAREHOUSES.ADD_PRODUCT       Agregar producto (alta con entrada inicial)
│       ├── WAREHOUSES.EDIT_MIN_STOCK    Editar stock mínimo (ícono campana por fila)
│       └── WAREHOUSES.REGISTER_MOVEMENT Registrar movimiento (ícono flechas por fila)
│
├── Inventario                       /catalogo/inventario     InventoryListComponent
│   └── (sin acciones de negocio — solo lectura: ver historial, filtro de stock bajo)
│
├── Impuestos                        /catalogo/impuestos      TaxRateListComponent
│   ├── TAX_RATES.CREATE             Nuevo impuesto (+ variante "nuevo en esta empresa")
│   ├── TAX_RATES.EDIT               Editar (ícono lápiz por fila)
│   └── TAX_RATES.DEACTIVATE         Desactivar (ícono basura por fila)
│
├── Categorías                       /catalogo/categorias     CategoryListComponent
│   ├── CATEGORIES.CREATE            Nueva categoría (+ variante "nueva en esta empresa")
│   ├── CATEGORIES.EDIT              Editar (ícono lápiz por fila)
│   └── CATEGORIES.DEACTIVATE        Desactivar (ícono basura por fila)
│
├── Productos                        /catalogo/productos      ProductListComponent
│   ├── PRODUCTS.CREATE              Nuevo producto (+ variante "nuevo en esta empresa")
│   ├── PRODUCTS.EDIT                Editar (ícono lápiz por fila)
│   ├── PRODUCTS.DEACTIVATE          Desactivar (ícono basura por fila)
│   └── PRODUCTS.ASSIGN_COMBO_ITEMS  Editar componentes del combo (ícono caja por fila, solo si isCombo)
│
├── Clientes                         /catalogo/clientes       CustomerListComponent
│   ├── CUSTOMERS.CREATE             Nuevo cliente (+ variante "nuevo en esta empresa")
│   ├── CUSTOMERS.EDIT               Editar (ícono lápiz por fila)
│   └── CUSTOMERS.DEACTIVATE         Desactivar (ícono basura por fila)
│
└── Proveedores                      /catalogo/proveedores    SupplierListComponent
    ├── SUPPLIERS.CREATE             Nuevo proveedor (+ variante "nuevo en esta empresa")
    ├── SUPPLIERS.EDIT               Editar (ícono lápiz por fila)
    └── SUPPLIERS.DEACTIVATE         Desactivar (ícono basura por fila)

Caja
├── Cajas                            /caja/cajas              CashRegisterListComponent
│   ├── CASH_REGISTERS.CREATE        Nueva caja (+ variante "nueva en esta empresa")
│   ├── CASH_REGISTERS.EDIT          Editar (ícono lápiz por fila)
│   └── CASH_REGISTERS.DEACTIVATE    Desactivar (ícono basura por fila)
│
└── Turnos de caja                   /caja/turnos             CashSessionListComponent
    ├── CASH_SESSIONS.OPEN           Abrir caja / abrir turno
    └── CASH_SESSIONS.CLOSE          Cerrar turno

Ventas                                /ventas                 SalePosComponent
├── SALES.REGISTER                   Registrar venta (tab "Nueva venta")
├── SALES.CANCEL                     Cancelar venta (ícono por fila, tab "Historial")
└── SALES.SEND_RECEIPT               Enviar recibo por correo (modal de recibo)

Devoluciones                          /devoluciones           ReturnListComponent
└── RETURNS.REGISTER                 Registrar devolución

Reportes                              /reportes               ReportListComponent
└── (sin acciones de negocio — las 3 pestañas son de solo lectura: ventas por periodo,
    productos más vendidos, cortes de caja)

Consignaciones                        /consignaciones         ConsignmentListComponent
└── CONSIGNMENT.SETTLE               Liquidar a un proveedor (ícono check-circle por fila, tab "Saldos pendientes")
```

---

## Tabla plana (para seed del backend)

| ID | Módulo (ventana) | Ruta | Componente | Acción | Disparador en UI |
|---|---|---|---|---|---|
| `USERS.CREATE` | Usuarios | `/admin/users` | `UserListComponent` | Crear usuario | Botón "Nuevo usuario" / `group-add-btn` |
| `USERS.EDIT` | Usuarios | `/admin/users` | `UserListComponent` | Editar usuario | Ícono lápiz por fila |
| `USERS.DEACTIVATE` | Usuarios | `/admin/users` | `UserListComponent` | Desactivar usuario | Ícono basura por fila |
| `USERS.RESET_PASSWORD` | Usuarios | `/admin/users` | `UserListComponent` | Restablecer contraseña | Ícono "reset" por fila |
| `USERS.REASSIGN_COMPANY` | Usuarios | `/admin/users` | `UserListComponent` | Cambiar de empresa | Ícono "mover" por fila |
| `NAV_ROUTES.CREATE` | Rutas de Navegación | `/admin/routes` | `RouteListComponent` | Crear ruta | Botón "Nueva ruta" / `group-add-btn` |
| `NAV_ROUTES.EDIT` | Rutas de Navegación | `/admin/routes` | `RouteListComponent` | Editar ruta | Ícono lápiz por fila |
| `NAV_ROUTES.DEACTIVATE` | Rutas de Navegación | `/admin/routes` | `RouteListComponent` | Desactivar ruta | Ícono basura por fila |
| `ROLES.CREATE` | Roles | `/admin/roles` | `RoleListComponent` | Crear rol | Botón "Nuevo rol" / `group-add-btn` |
| `ROLES.EDIT` | Roles | `/admin/roles` | `RoleListComponent` | Editar rol | Ícono lápiz por fila |
| `ROLES.DEACTIVATE` | Roles | `/admin/roles` | `RoleListComponent` | Desactivar rol | Ícono basura por fila |
| `ROLES.ASSIGN_ROUTES` | Roles | `/admin/roles` | `RoleListComponent` | Asignar ventanas al rol | Ícono "sitemap" por fila |
| `ROLES.ASSIGN_PERMISSIONS` | Roles | `/admin/roles` | `RoleListComponent` | Asignar permisos de acción al rol | Ícono "check-square" por fila |
| `COMPANIES.CREATE` | Empresas | `/admin/empresas` | `CompanyListComponent` | Crear empresa | Botón "Nueva empresa" |
| `COMPANIES.EDIT` | Empresas | `/admin/empresas` | `CompanyListComponent` | Editar empresa | Ícono lápiz por fila |
| `COMPANIES.DEACTIVATE` | Empresas | `/admin/empresas` | `CompanyListComponent` | Desactivar empresa | Ícono basura por fila |
| `COMPANIES.UPLOAD_LOGO` | Empresas | `/admin/empresas` | `CompanyListComponent` | Subir/cambiar logo | Input de archivo en modal de edición |
| `BRANCHES.CREATE` | Sucursales | `/catalogo/sucursales` | `BranchListComponent` | Crear sucursal | Botón "Nueva sucursal" / `group-add-btn` |
| `BRANCHES.EDIT` | Sucursales | `/catalogo/sucursales` | `BranchListComponent` | Editar sucursal | Ícono lápiz por fila |
| `BRANCHES.DEACTIVATE` | Sucursales | `/catalogo/sucursales` | `BranchListComponent` | Desactivar sucursal | Ícono basura por fila |
| `WAREHOUSES.CREATE` | Almacenes | `/catalogo/almacenes` | `WarehouseListComponent` | Crear almacén | Botón "Nuevo almacén" / `group-add-btn` |
| `WAREHOUSES.EDIT` | Almacenes | `/catalogo/almacenes` | `WarehouseListComponent` | Editar almacén | Ícono lápiz por fila |
| `WAREHOUSES.DEACTIVATE` | Almacenes | `/catalogo/almacenes` | `WarehouseListComponent` | Desactivar almacén | Ícono basura por fila |
| `WAREHOUSES.ADD_PRODUCT` | Almacenes (detalle) | `/catalogo/almacenes/:id` | `WarehouseDetailComponent` | Agregar producto al almacén | Botón "Agregar producto" |
| `WAREHOUSES.EDIT_MIN_STOCK` | Almacenes (detalle) | `/catalogo/almacenes/:id` | `WarehouseDetailComponent` | Editar stock mínimo | Ícono campana por fila |
| `WAREHOUSES.REGISTER_MOVEMENT` | Almacenes (detalle) | `/catalogo/almacenes/:id` | `WarehouseDetailComponent` | Registrar movimiento de inventario | Ícono flechas por fila |
| `TAX_RATES.CREATE` | Impuestos | `/catalogo/impuestos` | `TaxRateListComponent` | Crear impuesto | Botón "Nuevo impuesto" / `group-add-btn` |
| `TAX_RATES.EDIT` | Impuestos | `/catalogo/impuestos` | `TaxRateListComponent` | Editar impuesto | Ícono lápiz por fila |
| `TAX_RATES.DEACTIVATE` | Impuestos | `/catalogo/impuestos` | `TaxRateListComponent` | Desactivar impuesto | Ícono basura por fila |
| `CATEGORIES.CREATE` | Categorías | `/catalogo/categorias` | `CategoryListComponent` | Crear categoría | Botón "Nueva categoría" / `group-add-btn` |
| `CATEGORIES.EDIT` | Categorías | `/catalogo/categorias` | `CategoryListComponent` | Editar categoría | Ícono lápiz por fila |
| `CATEGORIES.DEACTIVATE` | Categorías | `/catalogo/categorias` | `CategoryListComponent` | Desactivar categoría | Ícono basura por fila |
| `PRODUCTS.CREATE` | Productos | `/catalogo/productos` | `ProductListComponent` | Crear producto | Botón "Nuevo producto" / `group-add-btn` |
| `PRODUCTS.EDIT` | Productos | `/catalogo/productos` | `ProductListComponent` | Editar producto | Ícono lápiz por fila |
| `PRODUCTS.DEACTIVATE` | Productos | `/catalogo/productos` | `ProductListComponent` | Desactivar producto | Ícono basura por fila |
| `PRODUCTS.ASSIGN_COMBO_ITEMS` | Productos | `/catalogo/productos` | `ProductListComponent` | Editar componentes de un combo/kit | Ícono caja por fila (solo visible si `product.isCombo`) |
| `CUSTOMERS.CREATE` | Clientes | `/catalogo/clientes` | `CustomerListComponent` | Crear cliente | Botón "Nuevo cliente" / `group-add-btn` |
| `CUSTOMERS.EDIT` | Clientes | `/catalogo/clientes` | `CustomerListComponent` | Editar cliente | Ícono lápiz por fila |
| `CUSTOMERS.DEACTIVATE` | Clientes | `/catalogo/clientes` | `CustomerListComponent` | Desactivar cliente | Ícono basura por fila |
| `SUPPLIERS.CREATE` | Proveedores | `/catalogo/proveedores` | `SupplierListComponent` | Crear proveedor | Botón "Nuevo proveedor" / `group-add-btn` |
| `SUPPLIERS.EDIT` | Proveedores | `/catalogo/proveedores` | `SupplierListComponent` | Editar proveedor | Ícono lápiz por fila |
| `SUPPLIERS.DEACTIVATE` | Proveedores | `/catalogo/proveedores` | `SupplierListComponent` | Desactivar proveedor | Ícono basura por fila |
| `CASH_REGISTERS.CREATE` | Cajas | `/caja/cajas` | `CashRegisterListComponent` | Crear caja | Botón "Nueva caja" / `group-add-btn` |
| `CASH_REGISTERS.EDIT` | Cajas | `/caja/cajas` | `CashRegisterListComponent` | Editar caja | Ícono lápiz por fila |
| `CASH_REGISTERS.DEACTIVATE` | Cajas | `/caja/cajas` | `CashRegisterListComponent` | Desactivar caja | Ícono basura por fila |
| `CASH_SESSIONS.OPEN` | Turnos de caja | `/caja/turnos` | `CashSessionListComponent` | Abrir turno | Botón "Abrir caja" |
| `CASH_SESSIONS.CLOSE` | Turnos de caja | `/caja/turnos` | `CashSessionListComponent` | Cerrar turno | Botón "Cerrar turno" |
| `SALES.REGISTER` | Ventas | `/ventas` | `SalePosComponent` | Registrar venta | Botón "Registrar venta" (tab "Nueva venta") |
| `SALES.CANCEL` | Ventas | `/ventas` | `SalePosComponent` | Cancelar venta | Ícono cancelar por fila (tab "Historial") |
| `SALES.SEND_RECEIPT` | Ventas | `/ventas` | `SalePosComponent` | Enviar recibo por correo | Botón "Enviar" en modal de recibo |
| `RETURNS.REGISTER` | Devoluciones | `/devoluciones` | `ReturnListComponent` | Registrar devolución | Botón "Nueva devolución" → "Registrar devolución" |
| `CONSIGNMENT.SETTLE` | Consignaciones | `/consignaciones` | `ConsignmentListComponent` | Liquidar a un proveedor consignador | Ícono "check-circle" por fila (tab "Saldos pendientes") |

**Total: 52 acciones** en 17 ventanas con acciones de negocio (2 ventanas — Inventario y Reportes —
son de solo lectura y no aparecen en la tabla).
