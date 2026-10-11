import { Routes } from '@angular/router';

export const UNITS_OF_MEASURE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/unit-of-measure-list/unit-of-measure-list.component').then(
        (m) => m.UnitOfMeasureListComponent
      )
  }
];
