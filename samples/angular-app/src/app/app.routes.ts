import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'http-client' },
  {
    path: 'http-client',
    loadComponent: () =>
      import('./http-client.page').then((module) => module.HttpClientPage),
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
  { path: '**', redirectTo: 'http-client' },
];
