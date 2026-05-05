# `@orval/angular`

[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/orval-labs/orval/actions/workflows/tests.yaml/badge.svg)](https://github.com/orval-labs/orval/actions/workflows/tests.yaml)

![orval - Restful Client Generator](./logo/orval-logo-horizontal.svg?raw=true)

Angular generator support for [Orval](https://orval.dev).

This package powers Orval's Angular output and is responsible for generating:

- injectable Angular `HttpClient` service classes
- signal-first Angular `httpResource` helpers
- mixed `both` mode output with service classes plus sibling `*.resource.ts`
  files
- Angular-specific response typing, request options, runtime validation, and
  helper utilities

In most application projects you configure Angular output through the main
`orval` package. This package exists so the Angular generator can be versioned,
tested, and consumed as a standalone builder inside the Orval monorepo.

Visit [orval.dev](https://orval.dev) for guides, API docs, and examples.

## What it generates

`@orval/angular` supports three Angular retrieval modes through
`override.angular.retrievalClient` (or the legacy `override.angular.client`
alias):

| Mode           | Generated output                                               | Best for                                                    |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `httpClient`   | Retrievals stay on injectable Angular service classes          | Conventional service-based Angular APIs                     |
| `httpResource` | Signal-first resource helpers for retrieval-style operations   | Angular apps using signals for read flows                   |
| `both`         | Service classes plus sibling `*.resource.ts` retrieval helpers | Projects that want signal-first reads and imperative writes |

Mutation-style operations continue to use generated `HttpClient` service
methods by default unless a per-operation override changes classification.

If `override.angular.retrievalClient` is omitted, Angular generation defaults to
`httpClient` mode.

## Example configuration

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      client: 'angular',
      target: 'src/api/petstore.ts',
      schemas: 'src/api/model',
      mode: 'tags-split',
      override: {
        angular: {
          retrievalClient: 'httpResource',
          runtimeValidation: true,
        },
      },
    },
  },
});
```

For end-user docs and richer examples, see:

- [Angular guide](https://orval.dev/guides/angular)
- [Angular sample app](https://github.com/orval-labs/orval/tree/master/samples/angular-app)

## Angular-specific features

This package includes support for:

- `HttpClient` observe overload generation
- signal-based parameter generation for `httpResource`
- multi-content-type response branching via generated `Accept` helpers
- Zod-backed runtime validation for Angular output
- resource option helpers such as `defaultValue`, `debugName`, `injector`, and
  `equal`
- generated `ClientResult` / `ResourceResult` aliases
- `ResourceState<T>` and `toResourceState()` helpers for resource integration

## Development

Useful package-local scripts:

- `pnpm --filter @orval/angular build`
- `pnpm --filter @orval/angular test`
- `pnpm --filter @orval/angular lint`
- `pnpm --filter @orval/angular typecheck`

## More samples

You can explore additional Orval samples here:

- [angular app](https://github.com/orval-labs/orval/tree/master/samples/angular-app)
- [react app](https://github.com/orval-labs/orval/tree/master/samples/react-app)
- [react query](https://github.com/orval-labs/orval/tree/master/samples/react-query)
- [react app with swr](https://github.com/orval-labs/orval/tree/master/samples/react-app-with-swr)
- [svelte query](https://github.com/orval-labs/orval/tree/master/samples/svelte-query)
- [vue query](https://github.com/orval-labs/orval/tree/master/samples/vue-query)
- [hono](https://github.com/orval-labs/orval/tree/master/samples/hono)
- [next app with fetch](https://github.com/orval-labs/orval/tree/master/samples/next-app-with-fetch)
