import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/inventory-list/inventory-list.component').then(
        (m) => m.InventoryListComponent
      )
  }
];
