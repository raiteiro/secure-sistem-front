import { Routes } from '@angular/router';

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/supplier-list/supplier-list.component').then(
        (m) => m.SupplierListComponent
      )
  }
];
