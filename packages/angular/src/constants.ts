import type { GeneratorDependency } from '@orval/core';

export const ANGULAR_HTTP_CLIENT_DEPENDENCIES = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders', values: true },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
      { name: 'HttpResponse', alias: 'AngularHttpResponse', values: true }, // alias to prevent naming conflict with msw
      { name: 'HttpEvent' },
    ],
    dependency: '@angular/common/http',
  },
  {
    exports: [
      { name: 'Injectable', values: true },
      { name: 'inject', values: true },
    ],
    dependency: '@angular/core',
  },
  {
    exports: [{ name: 'Observable', values: true }],
    dependency: 'rxjs',
  },
] as const satisfies readonly GeneratorDependency[];

export const ANGULAR_HTTP_RESOURCE_DEPENDENCIES = [
  {
    exports: [
      { name: 'httpResource', values: true },
      { name: 'HttpResourceOptions' },
      { name: 'HttpResourceRef' },
      { name: 'HttpResourceRequest' },
      { name: 'HttpHeaders', values: true },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
    ],
    dependency: '@angular/common/http',
  },
  {
    exports: [{ name: 'Signal' }, { name: 'ResourceStatus' }],
    dependency: '@angular/core',
  },
] as const satisfies readonly GeneratorDependency[];
