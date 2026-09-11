import { Routes } from '@angular/router';

export const COMPANIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/company-list/company-list.component').then(
        (m) => m.CompanyListComponent
      )
  }
];
