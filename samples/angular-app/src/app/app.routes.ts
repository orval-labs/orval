import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pets-store.page').then((module) => module.PetsStorePage),
  },
  {
    path: 'http-client',
    loadComponent: () =>
      import('./http-client.page').then((module) => module.HttpClientPage),
  },
  {
    path: 'http-client-custom-params',
    loadComponent: () =>
      import('./http-client-custom-params.page').then(
        (module) => module.HttpClientCustomParamsPage,
      ),
  },
  {
    path: 'http-resource',
    loadComponent: () =>
      import('./http-resource.page').then((module) => module.HttpResourcePage),
  },
  {
    path: 'http-resource-zod',
    loadComponent: () =>
      import('./http-resource-zod.page').then(
        (module) => module.HttpResourceZodPage,
      ),
  },
  {
    path: 'zod-demo',
    loadComponent: () =>
      import('./zod-validation-demo').then((module) => module.ZodValidationDemo),
  },
  { path: '**', redirectTo: '' },
];
