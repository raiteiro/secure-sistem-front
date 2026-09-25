import { Routes } from '@angular/router';

export const RETURNS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/return-list/return-list.component').then((m) => m.ReturnListComponent)
  }
];
