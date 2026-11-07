import { Routes } from '@angular/router';

export const PRODUCT_EXTRAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/product-extra-list/product-extra-list.component').then(
        (m) => m.ProductExtraListComponent
      )
  }
];
