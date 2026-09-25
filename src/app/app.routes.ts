import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { mustChangePasswordGuard } from './core/guards/must-change-password.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      )
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      )
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      )
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [mustChangePasswordGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'admin/users',
        loadChildren: () =>
          import('./features/users/users.routes').then((m) => m.USERS_ROUTES)
      },
      {
        path: 'admin/routes',
        loadChildren: () =>
          import('./features/nav-routes/nav-routes.routes').then((m) => m.NAV_ROUTES_ROUTES)
      },
      {
        path: 'admin/roles',
        loadChildren: () =>
          import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES)
      },
      {
        path: 'admin/empresas',
        loadChildren: () =>
          import('./features/companies/companies.routes').then((m) => m.COMPANIES_ROUTES)
      },
      {
        path: 'catalogo/sucursales',
        loadChildren: () =>
          import('./features/branches/branches.routes').then((m) => m.BRANCHES_ROUTES)
      },
      {
        path: 'catalogo/almacenes',
        loadChildren: () =>
          import('./features/warehouses/warehouses.routes').then((m) => m.WAREHOUSES_ROUTES)
      },
      {
        path: 'catalogo/inventario',
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES)
      },
      {
        path: 'catalogo/impuestos',
        loadChildren: () =>
          import('./features/tax-rates/tax-rates.routes').then((m) => m.TAX_RATES_ROUTES)
      },
      {
        path: 'catalogo/categorias',
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES)
      },
      {
        path: 'catalogo/productos',
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES)
      },
      {
        path: 'catalogo/clientes',
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES)
      },
      {
        path: 'catalogo/proveedores',
        loadChildren: () =>
          import('./features/suppliers/suppliers.routes').then((m) => m.SUPPLIERS_ROUTES)
      },
      {
        path: 'caja/cajas',
        loadChildren: () =>
          import('./features/cash-registers/cash-registers.routes').then(
            (m) => m.CASH_REGISTERS_ROUTES
          )
      },
      {
        path: 'caja/turnos',
        loadChildren: () =>
          import('./features/cash-sessions/cash-sessions.routes').then(
            (m) => m.CASH_SESSIONS_ROUTES
          )
      },
      {
        path: 'ventas',
        loadChildren: () =>
          import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES)
      },
      {
        path: 'devoluciones',
        loadChildren: () =>
          import('./features/returns/returns.routes').then((m) => m.RETURNS_ROUTES)
      },
      {
        path: 'reportes',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES)
      },
      {
        path: 'consignaciones',
        loadChildren: () =>
          import('./features/consignment/consignment.routes').then((m) => m.CONSIGNMENT_ROUTES)
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
