import { Routes } from '@angular/router';

export const CONSIGNMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/consignment-list/consignment-list.component').then(
        (m) => m.ConsignmentListComponent
      )
  }
];
