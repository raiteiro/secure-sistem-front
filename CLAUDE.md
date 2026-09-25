# SecureSistemFront

> Migrado desde los steering docs de Kiro (`.kiro/steering/*.md`, en el directorio padre del repo). Este archivo se carga automáticamente como contexto en cada sesión de Claude Code.

## Visión General del Proyecto

Sistema base genérico en Angular 19 diseñado para ser la plantilla raíz de múltiples sistemas derivados. Toda decisión de arquitectura debe priorizar la reutilización, modularidad y extensibilidad. Este directorio (raíz del repo) **es** el proyecto Angular.

**Stack Tecnológico**
- Frontend: Angular 19 (standalone components)
- Estilos: SCSS
- UI: Angular Material / PrimeNG (ver componentes existentes en `shared/`)
- Estado: Signals (Angular Signals API)
- HTTP: HttpClient con interceptors
- Routing: Lazy loading por módulo funcional
- Testing: Jasmine + Karma (unit), Cypress (e2e)

**Principios de Diseño**
- DRY: extraer lógica común en servicios y utilidades compartidas
- SOLID: cada componente/servicio tiene una responsabilidad clara
- Composición sobre herencia
- Feature-based structure: organizar por funcionalidad, no por tipo de archivo
- Configuración sobre código: lo que pueda variar entre sistemas derivados debe ser configurable

## Arquitectura Reutilizable (core/ y shared/)

Este sistema es una plantilla base. Todo lo que se construya en `core/` y `shared/` debe funcionar sin modificación en cualquier sistema derivado. Las `features/` son específicas de cada sistema.

### Componentes Shared (`shared/`)
Deben ser:
- Standalone y sin dependencias de features específicas
- Configurables via `@Input()` / Signals `input()`
- Con valores por defecto razonables
- Documentados con comentarios JSDoc en las propiedades públicas

**Ya implementados:**
- `NotificationService` (`core/services/notification.service.ts`): servicio centralizado de toasts
  - Métodos: `success()`, `error()`, `warn()`, `info()`, `httpError()`
  - Se provee globalmente; `MessageService` se declara solo en `MainLayoutComponent`
  - El toast global está en `MainLayoutComponent` con `key="global"`
  - Los componentes individuales **no** deben agregar su propio `p-toast` ni `MessageService`
- Estilos de modal reutilizables: clases `rm-*` en `styles.scss` global
  - `rm-header`, `rm-title`, `rm-close`, `rm-body`, `rm-footer`
  - `rm-field-single`, `rm-row`, `rm-field`
  - `rm-btn-cancel`, `rm-btn-save`
  - Usar `p-dialog` con `[showHeader]="false"` y `styleClass="route-modal"`
- Custom toast styles: clases `custom-toast` en `styles.scss` global (gradiente por severidad + icono con fondo sólido)
- `HasPermissionDirective` (`shared/directives/has-permission.directive.ts`): directiva estructural `*appHasPermission="'MODULO.ACCION'"` que oculta el elemento si el usuario logueado no tiene ese permiso (ver [Permisos por acción (botones)](#permisos-por-acción-botones) más abajo)
- `PagerComponent` (`shared/components/pager/`): controles de paginación (`<app-pager [page] [totalPages] [totalCount] [pageSize] (pageChange)>`) para listas que consumen un `IPagedResult<T>` (`core/models/pagination.models.ts`) — ver [PAGINATION.md](PAGINATION.md) para qué endpoints ya están migrados a este contrato

**Componentes base esperados (pendientes/objetivo):**
- Tabla genérica con paginación, ordenamiento y filtros (la paginación en sí ya existe como `PagerComponent`, ver arriba — falta la tabla genérica que la envuelva)
- Formulario dinámico basado en configuración JSON
- Diálogos de confirmación reutilizables
- Componentes de notificación/toast
- Loading spinner/skeleton
- Breadcrumbs dinámicos
- Botones con estados (loading, disabled, variantes)

### Servicios Core (`core/`)
Singleton, funcionalidad transversal:
- `AuthService`: login, logout, refresh token, estado de sesión
- `HttpErrorInterceptor`: manejo centralizado de errores HTTP
- `TokenInterceptor`: adjuntar JWT a peticiones
- `NotificationService`: mostrar mensajes al usuario
- `PermissionsService` (`core/services/permissions.service.ts`): resuelve `has(permissionId)` para gatear botones por acción (ver [Permisos por acción (botones)](#permisos-por-acción-botones))
- `StorageService`: abstracción sobre localStorage/sessionStorage
- `ThemeService`: manejo de temas claro/oscuro
- `ConfigService`: configuración dinámica de la aplicación

### Patrones para Extensibilidad
- `InjectionToken` para configuraciones que cambien entre sistemas
- Interfaces para contratos de servicios (facilita mock en tests)
- Componentes wrapper sobre Angular Material para unificar estilos
- Feature flags para activar/desactivar funcionalidades por sistema

### Configuración por Sistema Derivado
Cada sistema derivado debe poder personalizar: tema de colores (SCSS variables), logo y branding, menú de navegación (JSON configurable), roles y permisos disponibles, endpoints de API (environment files), features habilitadas (feature flags).

## Estándares de Código

**Nomenclatura**
| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | PascalCase + sufijo | `UserListComponent` |
| Servicios | PascalCase + sufijo | `AuthService` |
| Interfaces | PascalCase + prefijo `I` | `IUser`, `IApiResponse<T>` |
| Enums | PascalCase | `UserRole`, `HttpStatusCode` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Variables/funciones | camelCase | `getUserById`, `isLoading` |
| Archivos | kebab-case | `user-list.component.ts`, `auth.service.ts` |
| Signals | camelCase + sufijo descriptivo | `userList`, `isLoadingSig` |

**Estructura de carpetas (feature-based)**
```
src/
├── app/
│   ├── core/                    # Servicios singleton, guards, interceptors
│   │   ├── services/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── models/              # Interfaces y enums globales
│   ├── shared/                  # Componentes, pipes y directivas reutilizables
│   │   ├── components/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── utils/
│   ├── features/                # Módulos funcionales (lazy loaded)
│   │   └── [feature-name]/
│   │       ├── components/
│   │       ├── services/
│   │       ├── models/
│   │       └── [feature].routes.ts
│   ├── layouts/                 # Layouts de la aplicación
│   └── app.routes.ts
├── assets/
├── environments/
└── styles/                      # SCSS globales, variables, mixins
```

**Reglas de Angular**
- Standalone components siempre (no NgModules)
- Signals para estado reactivo local
- `inject()` en lugar de constructor injection
- Rutas lazy-loaded con `loadComponent`/`loadChildren`
- Separar template y estilos en archivos propios cuando excedan 20 líneas
- Evitar `any`: tipar todo con interfaces
- `async` pipe o `toSignal()` para observables en templates
- Máximo 1 componente por archivo

**Reglas de SCSS**
- Variables SCSS para colores, espaciados y breakpoints
- Mobile-first: media queries con `min-width`
- BEM para naming de clases CSS cuando no se use Angular Material
- No usar `!important` salvo override justificado de librerías externas
- Todo componente debe ser 100% responsivo (mobile, tablet, desktop)
- Breakpoints estándar: 576px (sm), 768px (md), 992px (lg), 1200px (xl)
- Tablas: en mobile usar scroll horizontal o reestructurar a cards
- Sidebar: colapsable en pantallas menores a 768px
- Formularios: pasar de 2 columnas a 1 columna en mobile

## Sistema de Diseño / Guía de Estilos

**Color de marca por empresa (theming en vivo, vía paletas fijas)**
- Se probaron colores 100% libres (hex picker) con derivación automática (mezclas, HSL) y con colores crudos sin procesar — ambos enfoques se descartaron porque un color mal elegido (o su versión procesada) se veía mal. Diseño final: la empresa **elige una de 10 paletas ya armadas**, no un color libre. `Company.colorPreset: string | null` guarda el id de la paleta (`null` = `"purple"`, el look original del sistema)
- Las 10 paletas viven en `core/constants/color-presets.ts` (`COLOR_PRESETS`), cada una con `{ id, label, header, button }` ya combinados a mano para verse bien. Agregar/editar paletas se hace solo ahí — es la única fuente de verdad, tanto para el picker de Empresas como para `ThemeService`
- **Todas las paletas usan header oscuro + texto claro, sin excepción** — se probó una variante de fondo claro/texto oscuro (paleta "Cielo claro") y el contraste quedaba pobre en varias zonas del sidebar (importa para accesibilidad: usuarios mayores o con fatiga visual). Se descartó el modo de texto configurable en vez de intentar arreglarlo — un solo esquema de contraste que garantizar es más simple y más seguro que dos. **Si se agrega una paleta nueva, su `header` debe ser oscuro** — no hay soporte para header claro
- `ThemeService.applyPreset(presetId)` (`core/services/theme.service.ts`) resuelve el id a su paleta (`getColorPreset()`, cae a `"purple"` si no existe) y setea `--brand-header`/`--brand-button`/`--brand-button-rgb` — sin ninguna matemática de color, solo lookup. Se llama desde `MainLayoutComponent.ngOnInit()`, leyendo la empresa del usuario logueado vía `CompaniesService.getById(companyId)`
- Variables CSS resultantes en `:root` (`styles.scss` trae los defaults de la paleta "purple"):
  - `--brand-header`: color de navbar (sidebar), encabezados de modal (`.rm-header`) y `.p-confirm-dialog .p-dialog-header`
  - `--brand-button` / `--brand-button-rgb`: color de botones y de todo lo demás que antes usaba el acento (íconos, badges, bordes, focus rings, checkboxes/toggles, borde activo del sidebar)
  - `--brand-header-text` / `--brand-header-text-muted` / `--brand-header-overlay-weak` / `--brand-header-overlay-strong`: **fijas, ninguna paleta las cambia** (declaradas una sola vez en `styles.scss`, `ThemeService` no las toca)
- **El "difuminado" es una capa de transparencia blanco/negro superpuesta en CSS, NUNCA una mezcla con otro color.** Mismo patrón en botones (`.btn-primary`, `.rm-btn-save`, confirm-dialog-accept, paginador activo), sidebar y headers de modal:
  ```scss
  // Botón / sidebar (claro arriba-izq → oscuro abajo-der, aspecto "brillante")
  background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.15)), var(--brand-button);
  // Header de modal (oscuro arriba-izq → claro abajo-der)
  background: linear-gradient(135deg, rgba(0,0,0,0.25), rgba(255,255,255,0.08)), var(--brand-header);
  ```
  Al agregar un botón o header nuevo con este look, copiar este patrón — no derivar un segundo color.
- Empresas (solo admin de sistema): el modal ya no tiene inputs de color ni toggle de texto — es una grilla de 10 swatches (`.preset-grid`/`.preset-swatch`) donde cada botón muestra header/botón partidos a la mitad; clic asigna `form.colorPreset`. La tabla también resuelve el preset de cada fila (`presetOf(company)`) para pintar los mismos dos swatches
- **Todo componente dentro del layout autenticado debe usar las variables `--brand-*` en vez de hex literal** — y, si es una superficie con texto blanco encima (botón, header oscuro), usar el patrón de capa de transparencia de arriba, no el color plano solo (se ve sin relieve)
- Las pantallas **públicas** (login, forgot-password, reset-password, change-password) son la única excepción a propósito: se muestran antes de saber a qué empresa pertenece el usuario, así que se quedan con el morado/navy fijo de `styles.scss`, no usan las variables

**Paleta de colores**
```
Primario (gradiente):    #667eea → #764ba2
Fondo oscuro (sidebar):  #1a1a2e, #302b63, #24243e
Texto principal:         #1a1a2e
Texto secundario:        #6b7280, #8c8c9e, #4a4a5a
Fondo contenido:         #f4f6fa
Fondo cards:             #ffffff
Bordes:                  #e5e7eb, #f0f0f5, #e8eaf0, #f3f4f6
Fondo inputs:            #f9fafb
Focus inputs:            #667eea con box-shadow rgba(102, 126, 234, 0.12)

Colores de nivel (rutas):
- Nivel 0: #667eea (azul)
- Nivel 1: #10b981 (verde)
- Nivel 2: #f59e0b (amarillo)

Colores semánticos:
- Success: #059669 (bg: #ecfdf5)
- Error:   #dc2626 (bg: #fef2f2)
- Warn:    #f59e0b (bg: #fef3c7)
- Info:    #3b82f6 (bg: #eff6ff)
```

**Tipografía**
- Font family: `var(--font-family)` de PrimeNG (Inter/system)
- Labels: 0.6875rem–0.8125rem, uppercase, letter-spacing 0.5–0.6px, font-weight 600, color #4a4a5a o #6b7280
- Texto body: 0.875rem, color #374151
- Títulos h2: 1.5rem, font-weight 700, color #1a1a2e
- Subtítulos: 0.8125rem, color #8c8c9e
- Código/monospace: `'Courier New', monospace`, 0.8125rem, bg #f3f4f6, padding 0.2rem 0.5rem, radius 4px

**Bordes y radios**
- Cards: border-radius 16px, box-shadow `0 2px 12px rgba(0,0,0,0.06)`
- Inputs: border-radius 10px, border 2px solid #e5e7eb
- Botones primarios: border-radius 10px
- Badges/tags: border-radius 20px
- Botones de acción (icono): border-radius 8px, 34x34px
- Modales: border-radius 24px (subido de 20px — se veían muy cuadrados). Va en el `.p-dialog`/`.p-confirm-dialog` exterior **y también explícito** en `.rm-header`/`.rm-footer` (`24px 24px 0 0` / `0 0 24px 24px`) — no basta con confiar en el `overflow: hidden` del contenedor padre para recortar las esquinas, mejor declararlo en las dos puntas
- **Toda capa que quede DETRÁS de `.rm-header`/`.p-dialog-header` en el DOM debe tener `background: transparent !important`, nunca blanco.** En los modales `rm-*`, `.rm-header` es contenido proyectado DENTRO de `.p-dialog-content` (no directo dentro de `.p-dialog`) — así que **ambos**, `.p-dialog` **y** `.p-dialog-content`, necesitan `background: transparent !important` (olvidar uno de los dos no lo arregla, hubo que iterar dos veces sobre esto). El blanco real de la tarjeta lo pone `.rm-body` (que sí puede ser blanco, porque no tiene su propio border-radius ni queda detrás de nada redondeado). En el `ConfirmDialog` el mismo riesgo aplica a `.p-dialog` (ya transparente) — ahí `.p-dialog-content` sí puede quedarse blanco porque el header de PrimeNG es un elemento HERMANO, no un contenedor que lo envuelva
  - Motivo del problema: `.rm-header` tiene su propio `border-radius` en las esquinas superiores. Ese border-radius solo recorta el fondo/contenido de `.rm-header` mismo — la porción de esquina que "corta" deja ver lo que sea que esté pintado DETRÁS en esa zona. Si detrás hay blanco, se ve una "punta blanca" con forma de esquina redondeada asomando fuera del header oscuro. La solución no es más `overflow: hidden` (ya está y no alcanza) sino asegurarse de que no haya ningún blanco pintado detrás del área del header, en ningún nivel intermedio del DOM
- **El modal tiene alto máximo `90vh` con scroll interno solo en `.rm-body`** — formularios largos (ej. Empresas: nombre, RFC, límites, fecha, contacto, logo, paleta) pueden ser más altos que la ventana, y sin esto el modal se corría pegado al borde/taskbar en vez de scrollear. Mecanismo: `.p-dialog` y `.p-dialog-content` son `display: flex; flex-direction: column` con `max-height: 90vh`/`min-height: 0`, `.rm-header`/`.rm-footer` tienen `flex-shrink: 0` (siempre visibles), y `.rm-body` tiene `flex: 1 1 auto; min-height: 0; overflow-y: auto` (la única zona que scrollea). Si se agrega un modal muy largo nuevo, no hace falta tocar nada — ya hereda este comportamiento de las reglas globales

**Botones**
- Primario (`.btn-primary`): gradiente 135deg #667eea→#764ba2, color #fff, font-weight 600, hover: `translateY(-1px)` + box-shadow
- Cancelar (`.rm-btn-cancel`): border 2px solid #e5e7eb, bg #fff, color #6b7280, hover: border más oscuro
- Guardar (`.rm-btn-save`): mismo gradiente primario con icono `pi-check`
- Acción tabla (`.action-btn`): transparent, 34x34, hover: `scale(1.1)` + bg sutil por tipo (edit=azul, delete=rojo, routes=verde)

**Inputs**
- Todos los inputs usan estilos nativos HTML (NO componentes PrimeNG en modales)
- Padding: 0.7rem 0.875rem
- Border: 2px solid #e5e7eb, border-radius 10px, background #f9fafb
- Focus: border-color #667eea, bg #fff, box-shadow `0 0 0 3px rgba(102, 126, 234, 0.12)`
- Placeholder: color #b0b0c0
- Select nativo con `appearance: none` y flecha SVG custom

**Modales**
- Usar `p-dialog` de PrimeNG con `[showHeader]="false"` y `styleClass="route-modal"`
- Los estilos van en `styles.scss` global (`p-dialog` se renderiza como portal fuera del componente)
- Estructura interna: `.rm-header` (gradiente oscuro), `.rm-body`, `.rm-footer` (bg #f8f9fc)
- Clases: `rm-header`, `rm-title`, `rm-close`, `rm-body`, `rm-row`, `rm-field`, `rm-field-single`, `rm-footer`
- Campos de formulario en modales: `rm-field` (dentro de `rm-row`, layout de grid 2/3 cols) o `rm-field-single` (ancho completo, fuera de `rm-row`) — ambos con label + input nativo
- Grid: `rm-row` (2 cols), `rm-three` (3 cols)
- Toggle switch: CSS puro con clases `rm-toggle`, `rm-slider`
- **Antes de agregar un campo nuevo a un modal**: revisar en `styles.scss` que el wrapper que vas a usar (`.rm-field` o `.rm-field-single`) ya tenga estilos para el tipo de elemento que necesitas (`input`, `select`, `textarea`). Si falta (ej. históricamente `.rm-field-single` solo estilizaba `input`/`textarea` y no `select`, causando que un `<select>` se viera con el estilo nativo del navegador), **extiende la regla global en `styles.scss`** para ese wrapper en vez de escribir estilos sueltos en el componente — así todos los modales quedan consistentes automáticamente, no solo el campo nuevo.
- **Regla general para componentes PrimeNG que se renderizan como portal** (`p-dialog`, `p-confirmDialog`, `p-toast`, y cualquier otro que use overlay/appendTo body): el CSS del `.scss` del componente **no les llega** porque quedan fuera de su árbol del DOM. Todo su estilo va en `styles.scss` global, apuntando a las clases reales de PrimeNG (`.p-dialog`, `.p-confirm-dialog`, `.p-toast`, etc.). Si un elemento de este tipo se ve "sin estilo" o con el look por defecto de PrimeNG, la causa casi siempre es esta, no un selector CSS mal escrito.
  - Esto incluye `:host ::ng-deep` dentro del componente — también falla, por la misma razón (`:host ::ng-deep .foo` exige que `.foo` sea descendiente del host **en el DOM real**, y el mask+panel de `p-dialog` no lo es). Ya se encontró una regla así, muerta, en `route-list.component.scss` apuntando a `.p-dialog`/`.p-dialog-content`/`.p-dialog-mask` — se eliminó porque el `.route-modal` global en `styles.scss` ya cubre exactamente eso. Los `.rm-header`/`.rm-title`/`.rm-close`/etc. locales de cada componente sí funcionan (llegan vía content projection con el atributo de encapsulación de Angular, que no depende de la posición en el DOM), así que no hace falta duplicarlos como `:host ::ng-deep` tampoco.

**Tablas**
- Usar `p-table` o `p-treeTable` de PrimeNG con override de estilos via `::ng-deep`
- Headers: bg #f8f9fc, uppercase, 0.75rem, letter-spacing 0.6px, border-bottom 2px solid #e8eaf0
- Rows: padding 0.75–0.875rem 1.25rem, border-bottom 1px solid #f3f4f6
- Hover: bg #f8f9fc
- Paginator: botones 2.25rem con radius 8px, activo con gradiente primario

**Page headers**
- Estructura: `.page-header` con flex justify-between
- Izquierda: `.header-left` con icono en badge (bg rgba del color, padding 0.75rem, radius 12px) + h2 + subtitle
- Derecha: `.btn-primary`

**Confirmaciones (ConfirmDialog)**
- Usar `ConfirmationService.confirm({...})` de PrimeNG con un `<p-confirmDialog />` en el componente (patrón ya usado en Roles, Empresas, Usuarios)
- **No estilizar por componente**: `p-confirmDialog` se renderiza como portal fuera del árbol del componente (igual que `p-dialog`), así que cualquier CSS en el `.scss` del componente no le llega — el estilo va en `styles.scss` global, bajo el bloque `/* ===== Confirm Dialog Global Styles ===== */`, con selectores sobre las clases reales de PrimeNG: `.p-dialog.p-confirm-dialog`, `.p-confirm-dialog-icon`, `.p-confirm-dialog-message`, `.p-confirm-dialog-accept`, `.p-confirm-dialog-reject`
- Ya queda con header oscuro degradado, icono de advertencia con fondo ámbar, botón de aceptar con el gradiente primario y botón de rechazar en el estilo `rm-btn-cancel` — no hace falta tocar nada para que un nuevo `confirm()` se vea bien, solo pasar `header`, `icon`, `message`, `acceptLabel`, `rejectLabel` como ya se hace

**Notificaciones**
- Usar `NotificationService` (`core/services/notification.service.ts`)
- NO agregar `p-toast` ni `MessageService` en componentes individuales
- El toast global está en `MainLayoutComponent` con `key="global"`
- Estilos en `styles.scss` con clase `custom-toast`
- Cada severidad tiene gradiente de fondo y icono con fondo sólido

**Sidebar**
- Ancho expandido: 260px, colapsado: 64px
- Header (arriba, `.sidebar-header`): muestra el **nombre de la empresa del usuario logueado** (`authService.currentUser()?.companyName`), con fallback a "Sistema de Gestión" si por algo no está disponible. `.sidebar-brand` trunca con ellipsis (`text-overflow: ellipsis` + `min-width: 0`, necesario para que el ellipsis funcione dentro de un flex item) y lleva `[title]` con el nombre completo para cuando se corta
- Background: mismo patrón de "difuminado" que botones/headers de modal — capa `linear-gradient(135deg, rgba(0,0,0,0.25), rgba(255,255,255,0.08))` encima de `var(--brand-header)` (NO un segundo color derivado, ver "Color de marca por empresa"). Hover/activo: `var(--brand-header-overlay-weak)`/`-strong` (blancos, fijos — ver por qué en "Color de marca por empresa")
- Activo: además del overlay, border-left 3px `var(--brand-button)` — el estado activo se calcula comparando la ruta actual (`Router.events`) contra `item.routePath` en `SidebarComponent.isActive()`, **no** con `routerLinkActive` (los items son `<div>` con navegación por código, no `<a>`)
- Texto: `var(--brand-header-text-muted)`, activo: `var(--brand-header-text)` — ambas fijas (blanco/gris claro), todas las paletas usan header oscuro
- Footer (botón logout): fondo gris neutro fijo `#33333d` y texto rojo `#e57373` — **a propósito ninguno de los dos usa `var(--brand-header)`/`var(--brand-button)`**, para que esta zona se distinga igual sin importar la paleta que elija la empresa

**Textos y Copy**
- Lenguaje neutro en género: evitar terminar saludos/textos en `-o`/`-a` cuando se dirigen al usuario (ej. no usar "Bienvenido"). Preferir formas neutras naturales del español (verbos, sustantivos sin marca de género) en vez de fórmulas artificiales tipo "bienvenide" o "bienvenid@". Ejemplo ya aplicado: el saludo del login es "Inicia sesión", no "Bienvenido"
- Branding genérico: este es un sistema base para múltiples clínicas derivadas (médicas, veterinarias, nutrición, etc.), así que no hay que hardcodear un nombre de producto específico en el UI (ej. ya no se usa "SecureSistem" en login/sidebar/título de pestaña, se dejó "Sistema de Gestión" como texto neutro). Si se necesita branding con nombre propio, debe salir de configuración (environment/`InjectionToken`), no de texto fijo en el template

**Patrones de componentes**
- Cada feature tiene: listado + modal (no página separada para formularios simples)
- Users es la excepción: tiene página separada para crear/editar (más campos)
- Confirmar antes de desactivar con `ConfirmDialog` de PrimeNG
- Loading states con signals: `loading()`, `saving()`
- Todos los componentes son standalone

## Permisos por acción (botones)

Ya implementado en backend y frontend: permisos granulares por acción, además del permiso por
ventana completa que ya existía vía `NavigationRoute`. El catálogo completo de ids, con su ruta y
componente, vive en [PERMISSIONS.md](PERMISSIONS.md) — consultarlo antes de asignar un id nuevo,
para no duplicar convención ni número.

**Backend**: `GET /api/Permissions` (catálogo, `{ id, key, name, description, windowId, isActive,
isDefaultForNewRoles }` — `name` ya en español, `windowId` es el mismo valor que
`NavigationRoute.windowId`), `GET /api/Permissions/my-permissions` (los `key` del usuario
logueado), `GET`/`POST /api/Roles/{id}/permissions` (ver/asignar por rol, mismo patrón que
`/routes`). **Frontend**: `PermissionsService` (`core/services/permissions.service.ts`) pide
`my-permissions` una vez por sesión y expone `has(id)`; la asignación vive en el modal "Rutas y
permisos" de Roles (`RoleListComponent.onManageAccess`), junto con la asignación de ventanas — cada
acción se muestra anidada debajo de su ruta (emparejadas por `windowId`, nunca por `windowName`,
que es texto libre), no en una pantalla separada.

**Regla obligatoria a partir de ahora: todo botón que dispare una acción de negocio real (crear,
editar, desactivar, exportar, abrir/cerrar turno, enviar correo, etc. — ver "Qué cuenta como
acción" en PERMISSIONS.md) debe tener:**
1. Un id de permiso en formato `MODULO.ACCION` (mayúsculas, `_` como separador dentro de cada
   parte) — el módulo es estable por ventana, no cambia aunque cambie el texto del botón.
2. La directiva `*appHasPermission="'MODULO.ACCION'"` (`shared/directives/has-permission.directive.ts`)
   en el botón, para que se oculte si el usuario logueado no tiene ese permiso.

No hace falta gatear con la directiva: cerrar un modal, "Cancelar" de un formulario, cambiar de
tab, paginación, ni botones de solo lectura (ver detalle/historial) — el acceso a la ventana en sí
ya cubre esos casos.

**Cuando se cree un componente o ventana nueva con botones de acción**:
1. Agregar la fila correspondiente a la tabla de [PERMISSIONS.md](PERMISSIONS.md) (id, ventana,
   ruta, componente, acción, disparador), con la acción en español tal como debe verse en pantalla
   (ej. "Crear usuario") — el backend usa ese texto como `IPermission.name` al dar de alta el
   permiso, así que no hace falta traducirlo ni duplicarlo en el frontend.
2. Avisar para pasarle esos ids nuevos al backend, junto con el `windowId` de la ventana a la que
   pertenecen (`NavigationRoute.windowId`, ej. `"win-users"`) — ahí se generan los permisos
   correspondientes, ya con `name` en español y `windowId` vinculado, y se agregan a la base de
   datos. `RoleListComponent` empareja acción↔ruta por `windowId`, nunca por `windowName` (texto
   libre, no hay garantía de que calce).

Un botón con `*appHasPermission` apuntando a un id que el backend todavía no conoce simplemente se
comporta como si nadie (salvo admin de sistema) lo tuviera — no rompe nada, pero tampoco sirve
hasta que el backend lo dé de alta.

`isSystemAdmin` sigue mandando por encima de todo: un admin de sistema siempre ve todos los
botones, tenga o no el id en lo que devuelva `my-permissions`. Mientras esa llamada no ha resuelto
(justo después del login) `has()` no oculta nada, para evitar parpadeo — el enforcement real vive
en el backend en cada endpoint, esto es solo para no mostrar botones que fallarían con 403.

**Crear y Editar comparten modal y botón "Guardar" en casi todas las pantallas** (`onSave()`
decide si crea o actualiza según `isEdit()`). Son igual dos permisos distintos: se gatea el botón
de *entrada* por separado — el `+` "Nueva X"/`group-add-btn` con `CREATE`, el ícono de lápiz con
`EDIT` — y "Guardar" ejecuta lo que corresponda según por dónde entró. No hace falta gatear
"Guardar" aparte.

## Prácticas de Seguridad

**Autenticación y Autorización**
- JWT para autenticación con refresh token rotation
- Tokens almacenados en memoria (no localStorage para access token)
- Refresh token en httpOnly cookie cuando el backend lo soporte
- Guards de ruta para proteger secciones según rol
- Interceptor HTTP para adjuntar token y manejar 401/403

**Protección de Datos**
- No almacenar datos sensibles en localStorage/sessionStorage sin cifrar
- Sanitizar inputs del usuario (Angular lo hace por defecto, no desactivar)
- Validación de formularios tanto en cliente como expectativa de validación en servidor
- No exponer IDs internos o información de debug en producción

**Comunicación HTTP**
- Usar HTTPS exclusivamente
- Implementar CSRF protection cuando aplique
- Timeout configurable en peticiones HTTP
- Retry con backoff exponencial para errores transitorios (5xx)
- Interceptor de errores centralizado con logging

**Buenas prácticas generales**
- No incluir secrets, API keys o credenciales en el código fuente
- Usar environment files para configuración por entorno
- Content Security Policy headers cuando se controle el servidor
- Mantener dependencias actualizadas (audit periódico con `npm audit`)

## Metodología Ágil y Gestión del Proyecto

**Framework:** Scrum adaptado
- Sprints de 2 semanas
- Cada feature se descompone en User Stories con criterios de aceptación claros
- Tareas técnicas (spikes, refactors, deuda técnica) se documentan como Technical Stories

**Definición de Done (DoD)** — una tarea se considera terminada cuando:
1. El código compila sin errores ni warnings
2. Pasa todos los tests unitarios existentes
3. Tiene tests unitarios para la nueva funcionalidad (cobertura mínima 80%)
4. Sigue las convenciones de código del proyecto
5. No introduce dependencias innecesarias
6. La funcionalidad es accesible (ARIA labels, navegación por teclado)
7. Es responsive (mobile-first)
8. Está documentada si es un componente o servicio compartido

**Priorización de trabajo**
1. Bugs críticos y de seguridad
2. Features del sprint actual
3. Mejoras de rendimiento
4. Refactoring y deuda técnica
5. Nice-to-have features

**Convención de Commits (Conventional Commits)**
```
<tipo>(alcance): descripción breve

Tipos válidos:
- feat: nueva funcionalidad
- fix: corrección de bug
- refactor: reestructuración sin cambio funcional
- style: cambios de formato (no CSS)
- docs: documentación
- test: agregar o modificar tests
- chore: tareas de mantenimiento (deps, config)
- perf: mejora de rendimiento
```

**Branching Strategy (Git Flow simplificado)**
- `main`: producción estable
- `develop`: integración de features
- `feature/nombre-descriptivo`: nuevas funcionalidades
- `fix/nombre-descriptivo`: correcciones
- `release/x.x.x`: preparación de release
