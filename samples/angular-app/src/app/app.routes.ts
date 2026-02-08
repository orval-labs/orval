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
  { path: '**', redirectTo: 'http-client' },
];
