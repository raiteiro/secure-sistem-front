import { Routes } from '@angular/router';

export const WAREHOUSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/warehouse-list/warehouse-list.component').then(
        (m) => m.WarehouseListComponent
      )
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./components/warehouse-detail/warehouse-detail.component').then(
        (m) => m.WarehouseDetailComponent
      )
  }
];
