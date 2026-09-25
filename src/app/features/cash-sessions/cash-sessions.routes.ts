import { Routes } from '@angular/router';

export const CASH_SESSIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/cash-session-list/cash-session-list.component').then(
        (m) => m.CashSessionListComponent
      )
  }
];
