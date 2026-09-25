import { Routes } from '@angular/router';

export const CASH_REGISTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/cash-register-list/cash-register-list.component').then(
        (m) => m.CashRegisterListComponent
      )
  }
];
