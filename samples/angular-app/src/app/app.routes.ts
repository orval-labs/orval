import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pets-store.page').then((m) => m.PetsStorePage),
  },
  { path: 'zod-demo', loadComponent: () => import('./zod-validation-demo').then(m => m.ZodValidationDemo) },
];
