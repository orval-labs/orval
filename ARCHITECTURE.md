# Architecture

A short map of how Orval turns an OpenAPI spec into generated code. Package names are under `packages/`.

## Pipeline

`orval` (`packages/orval`) is the CLI and the programmatic entry point. `bin/orval.ts` and `generate()` in `generate.ts` both end up calling `generateSpec()` once per project:

1. `generateSpec()` (`generate-spec.ts`) calls `importSpecs()`, optionally cleans the output, then calls `writeSpecs()`.
2. `importSpecs()` (`import-specs.ts`) loads the spec, bundles external `$ref`s, applies the `transformer`, validates it, and upgrades it to OpenAPI 3.1. `importOpenApi()` then applies `input.filters` and calls `getApiBuilder()` (`api.ts`).
3. `getApiBuilder()` turns every path and verb into `GeneratorVerbOptions` (`generateVerbsOptions()` in core), then asks the selected client to render each operation. It returns a `GeneratorApiBuilder`; `importOpenApi()` turns that into the `WriteSpecBuilder` the writers get by merging in the component schemas and adding `target`, `info` and `spec` (`import-open-api.ts`).
4. `writeSpecs()` (`write-specs.ts`) picks a writer from core by `output.mode`, writes the files, and runs the formatter and hooks.

## Clients and mocks

`client.ts` resolves the selected client. `GENERATOR_LOADERS` maps a client name to a lazy `import()` of its top-level package (`@orval/axios`, `@orval/angular`, `@orval/query`, `@orval/solid-start`, `@orval/swr`, `@orval/pinia-colada`, `@orval/zod`, `@orval/effect`, `@orval/hono`, `@orval/fetch`, `@orval/mcp`), so only the selected entry module is imported directly (a custom `output.client` function gets all of them). This is not a strict loading boundary: packages have static dependencies (`@orval/query` imports `@orval/fetch`, `@orval/hono` imports `@orval/zod`), and the Zod schema writers in `write-zod-specs.ts` import `@orval/zod` whatever the client. Some names share a package: `axios-functions` uses `@orval/axios`, and `react-query`, `vue-query`, `svelte-query`, `solid-query` and `angular-query` all use `@orval/query`. Each package's default export builds a `ClientGeneratorsBuilder` (`client`, `header`, `dependencies`, `footer`, `title`, `extraFiles`).

`@orval/mock` is loaded the same way, and only when `output.mock` has generators. It provides the msw and faker generators.

## `@orval/core`

Every other package imports it. `src/` is split into:

- `getters/`: read a part of the spec (object, array, combined schemas, params, body, responses, route).
- `resolvers/`: resolve a schema or `$ref` to a TypeScript type (`resolveValue`, `resolveObject`, `resolveRef`).
- `generators/`: build the pieces of output, such as verb options, schema and component definitions, and mutators.
- `writers/`: write the output files, one per `output.mode`: `single`, `split`, `tags`, `tags-split`, `tags-operations` and `tags-operations-split`. Schema writers live here too.
- `utils/`, `types.ts`, `constants.ts`: shared helpers, types and constants.

### Getters and resolvers call each other

`resolveValue` calls `getScalar`, which calls `getObject`, `getArray` or `combineSchemas`. Those call back into `resolveValue` or `resolveObject` for each property, item or member. This is how nested and recursive schemas are resolved, so the import cycle between the two folders is expected. Recursion stops through `context.parents`, the list of references being expanded. A named ref already in it is emitted as its type name instead of being expanded again. An anonymous `$ref` already in it resolves to `unknown`, because TypeScript cannot name that recursive type. Keep this in mind before trying to break the cycle.

### Most-imported modules

`utils/` and `types.ts` are imported by most files in core, and `@orval/core` by every other package. A change there can affect every generator, so run the tests and `test:snapshots`.

---

Drafted with RepoLens, checked by hand.
