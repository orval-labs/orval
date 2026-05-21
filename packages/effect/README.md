[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# @orval/effect

Generates [Effect Schema](https://effect.website/docs/schema/introduction/) validators from OpenAPI specifications.

## Install

```sh
npm install -D @orval/effect
npm install effect
```

`effect` is a peer dependency (`>=3.10`). `@orval/effect` does not bundle it.

## Usage

Set `client: 'effect'` in your `orval.config`:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: { target: './petstore.yaml' },
    output: {
      client: 'effect',
      target: './src/api/schemas',
      mode: 'single',
    },
  },
});
```

## Generated output

```ts
import { Schema as S } from 'effect';

export const ListPetsQueryParams = S.Struct({
  limit: S.optional(S.String).annotations({
    description: 'How many items to return at one time (max 100)',
  }),
});
```

See the [Effect guide](https://orval.dev/guides/effect) and the [`swr-with-effect` sample](https://github.com/orval-labs/orval/tree/master/samples/swr-with-effect) for more.

## Why Effect alongside Zod?

`@orval/effect` mirrors `@orval/zod`'s output shape, but Effect Schemas bring capabilities Zod can't:

- **Encoded vs decoded type duality** — `Schema.Type<S>` (runtime) and `Schema.Encoded<S>` (wire) are distinct; `Schema.encode` round-trips back to the wire shape.
- **Branded types as a generator option** — `override.effect.useBrandedTypes: true` turns named schemas into Effect brands for nominal-typed IDs without hand-writing `.brand<...>()`.
- **First-class annotations** — OpenAPI `description`, `title`, `examples` flow into `S.annotations(...)` and stay queryable at the AST level.
- **AST, not method chains** — schemas are introspectable artifacts, composable structurally by downstream tooling.
- **Effect runtime integration** — decoded results pipe straight into Effect's typed-error / retry / concurrency primitives.

## Configuration

Options are read from `override.effect.*`:

- `strict` — fail on extra fields in object schemas
- `generate` — fine-grained control over which schemas (params/body/response) are emitted
- `useBrandedTypes` — map named schemas to branded types
- `generateEachHttpStatus` — emit a schema per response status code
