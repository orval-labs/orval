import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'HttpClient overview · Orval Angular Demo',
    loadComponent: () =>
      import('./pets-store.page').then((module) => module.PetsStorePage),
  },
  {
    path: 'http-client',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'http-client-custom-params',
    title: 'HttpClient custom params · Orval Angular Demo',
    loadComponent: () =>
      import('./http-client-custom-params.page').then(
        (module) => module.HttpClientCustomParamsPage,
      ),
  },
  {
    path: 'http-resource',
    title: 'httpResource services · Orval Angular Demo',
    loadComponent: () =>
      import('./http-resource.page').then((module) => module.HttpResourcePage),
  },
  {
    path: 'http-resource-zod',
    title: 'httpResource + Zod · Orval Angular Demo',
    loadComponent: () =>
      import('./http-resource-zod.page').then(
        (module) => module.HttpResourceZodPage,
      ),
  },
  {
    path: 'zod-demo',
    title: 'Zod runtime validation · Orval Angular Demo',
    loadComponent: () =>
      import('./zod-validation-demo').then(
        (module) => module.ZodValidationDemo,
      ),
  },
  { path: '**', redirectTo: '' },
];
