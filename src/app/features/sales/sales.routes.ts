import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/sale-pos/sale-pos.component').then((m) => m.SalePosComponent)
  }
];
