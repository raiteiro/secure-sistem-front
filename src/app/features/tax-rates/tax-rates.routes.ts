import { Routes } from '@angular/router';

export const TAX_RATES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/tax-rate-list/tax-rate-list.component').then(
        (m) => m.TaxRateListComponent
      )
  }
];
