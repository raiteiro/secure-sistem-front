import { Routes } from '@angular/router';

export const NAV_ROUTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/route-list/route-list.component').then((m) => m.RouteListComponent)
  }
];
