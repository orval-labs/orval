import type { GeneratorDependency } from '@orval/core';

export const ANGULAR_HTTP_CLIENT_DEPENDENCIES = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders' },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
      { name: 'HttpResponse', alias: 'AngularHttpResponse' }, // alias to prevent naming conflict with msw
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
  {
    exports: [{ name: 'DeepNonNullable' }],
    dependency: '@orval/core',
  },
] as const satisfies readonly GeneratorDependency[];

export const ANGULAR_HTTP_RESOURCE_DEPENDENCIES = [
  {
    exports: [
      { name: 'httpResource', values: true },
      { name: 'HttpResourceRef' },
      { name: 'HttpResourceRequest' },
      { name: 'HttpHeaders' },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
    ],
    dependency: '@angular/common/http',
  },
  {
    exports: [{ name: 'Signal', values: true }, { name: 'ResourceStatus' }],
    dependency: '@angular/core',
  },
  {
    exports: [{ name: 'DeepNonNullable' }],
    dependency: '@orval/core',
  },
] as const satisfies readonly GeneratorDependency[];
