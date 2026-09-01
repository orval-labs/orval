import type { GeneratorDependency } from '@orval/core';

export const ANGULAR_HTTP_CLIENT_DEPENDENCIES = [
  {
    // `HttpHeaders` and `HttpResponse` are not listed here: whether an
    // operation needs them as values (`instanceof` narrowing) or only as
    // types is decided per operation in `generateAngular`.
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
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
    // Only ever a return type; generated code never constructs one.
    exports: [{ name: 'Observable' }],
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
    exports: [
      { name: 'Signal' },
      { name: 'ResourceStatus' },
      { name: 'inject', values: true },
    ],
    dependency: '@angular/core',
  },
] as const satisfies readonly GeneratorDependency[];
