# Developing the Query Package

Developer guidelines for working on `@orval/query` — the TanStack Query generator that targets five frameworks (React, Vue, Angular, Svelte, Solid) from a single codebase via the `FrameworkAdapter` strategy pattern.

## How to Change Framework Behavior

### Change one framework

Edit its adapter file in `src/frameworks/<name>.ts`. The adapter method you override will only affect that framework.

### Change all frameworks the same way

Edit the default implementation in `withDefaults()` (`src/frameworks/index.ts`), or the shared generator that calls the adapter method (`src/query-generator.ts` / `src/mutation-generator.ts`).

### Change all frameworks but one needs special handling

Edit `withDefaults()` for the common case. Then override the method in the divergent adapter's file in `src/frameworks/`.

## How to Add or Modify Adapter Methods

**New defaultable method:** Add to `FrameworkAdapter` interface in `src/framework-adapter.ts`, add to `DefaultableFields` type, implement the default in `withDefaults()`. Adapters that need different behavior override it in their file.

**New required method:** Add to `FrameworkAdapter` interface (NOT to `DefaultableFields`). Must be implemented in every adapter file.

**Rule of thumb:** If most frameworks share the same implementation, make it defaultable. Only use a required method when each framework genuinely needs a distinct implementation.

## How the `prefix` Pattern Works

`src/query-options.ts` uses a string `prefix` (`'Use'` or `'Create'`) instead of framework booleans. Each adapter returns it from `getQueryOptionsDefinitionPrefix()`. This avoids framework conditionals inside shared code — the adapter decides the prefix, shared code just uses it.

## How to Add a New Framework

1. Create `src/frameworks/<name>.ts` with `create<Name>Adapter()` returning `FrameworkAdapterConfig`
2. Implement the required (non-defaultable) methods; override defaults as needed
3. Register in the `switch` in `createFrameworkAdapter()` (`src/frameworks/index.ts`)
4. Add dependency constants and builder in `src/dependencies.ts`
5. Register the dependency builder in the `dependenciesBuilder` map in `src/index.ts`
6. Add a sample app in `samples/` or at minimum a test config in `tests/configs/`
7. Build, regenerate all samples, test

## Testing Strategy After Changes

### One adapter file changed

```bash
vp run -F @orval/query test                                        # Unit tests
vp run -F @orval/core build:debug && vp run -F @orval/query build:debug   # Rebuild
vp run update-samples                                                      # Regenerate ALL samples
# Inspect that framework's sample output
vp run test:cli                                                            # Verify all generated code compiles
vp run test:samples                                                        # Run sample app tests
```

### Shared generator or `withDefaults()` changed

Same steps, but inspect ALL framework samples — changes propagate to every framework.

### Dependencies changed

Also check that imports in generated files are correct (no missing or extra imports).

**Always use `vp run update-samples`** to regenerate across all frameworks. Never regenerate only one sample when shared code changed.

## Snapshot coverage

Generated output for every client is committed under `tests/__snapshots__/`. A
change to `withDefaults` in `src/frameworks/index.ts`, or to any shared generator,
shows up as a snapshot diff across all five query frameworks. After an intentional
change, run `vp run -w test:snapshots:update` and review the diff.

Snapshots record what the generator produced, not whether it was correct. Output
can be recorded and still fail to compile; `tests/scripts/typecheck-generated.mjs`
is what catches that.

Three lists must agree before a client is covered: a config in `tests/configs/`, a
matching `generate:` script in `tests/package.json`, and an entry in the `dirs`
array in `tests/api-generation.spec.ts`. Nothing verifies that they agree — a
client missing from `dirs` is generated and type-checked, but never compared
against a snapshot.

## Solid Query option types

Adapter methods named here are declared in `src/framework-adapter.ts` and
implemented for Solid in `src/frameworks/solid.ts`. The option type is assembled
by `getQueryOptionsDefinition` in `src/query-options.ts`.

**The plain interface, not the accessor.** In `@tanstack/solid-query`,
`SolidQueryOptions` is an object type and `UseQueryOptions` is
`Accessor<SolidQueryOptions<T>>` — a function type, so options stay reactive.
`Partial<T>` maps over properties and a function type has none, so
`Partial<UseQueryOptions<T>>` is empty and accepts anything:

```ts
useListPets(params, { query: { staleTime: 'not a number' } }); // compiled, unchecked
```

Solid builds the type from `SolidQueryOptions` instead. `getOptionsReturnTypeName`
returns which name to use, accounting for `@tanstack/solid-query` 5.100.6 dropping
the `Solid` prefix.

**initialData.** TanStack Query decides whether `data` can be `undefined` from two
`useQuery` overloads: one taking `initialData`, one taking `initialData?: undefined`.
An optional `initialData` matches neither, and Solid cannot hide that behind a type
assertion because `shouldCastQueryOptions` returns `false`. So `initialData` is
removed from the base type and each generated hook declares the same overload pair,
adding it back per overload. `getInitialDataOptionsType` supplies the type to take
it from, wrapping the accessor alias in `ReturnType` to reach the object type.

**Options the caller must supply.** Infinite queries need `initialPageParam` and
`getNextPageParam`, which TanStack Query requires and orval cannot infer.
`getUserQueryOptionsConstraint` returns `require` (becomes required on
`options.query`, which makes `options` required too) and `exclude` (removed from
`options.query`). These render as
`Omit<Partial<Options>, require | exclude> & Pick<Options, require>`, each half
dropped when empty, so returning only `exclude` reshapes the type without requiring
anything. A property already set in `override.query.options` is dropped from
`require`, so callers are not asked for what the configuration provides.

**Required options force earlier parameters to widen.** TypeScript rejects a
required parameter after an optional one (TS1016), so a non-empty `require` means
preceding optional parameters become `name: undefined | T`, via
`widenOptionalPropsToUndefined` in `src/query-generator.ts`. Apply it only where
`options` is required: `invalidateListPets` and every other generated `invalidate`
helper ends in an optional `options?: InvalidateOptions`, and widening those would
force callers to pass `undefined` for nothing.

**Before adopting this in another adapter.** Two places build parameter lists from
the `definition` field rather than `implementation` and need the same widening
first, or the generated signatures fail with TS1016: the overload declarations in
`overrideTypes` in `src/query-generator.ts`, and `getHookPropsDefinitions` in
`src/frameworks/angular.ts` and `src/frameworks/svelte.ts`.

## Common Pitfalls

- **Forgetting `vp run update-samples`** after changing generation logic — CI will catch stale samples as a diff.
- **Testing only one framework** after changing `withDefaults()` or shared generators — regressions in other frameworks won't be caught.
- **Adding `if (isAngular)` in shared generators** — use adapter methods instead. The FrameworkAdapter pattern exists to avoid framework conditionals in shared code.
- **Framework detection helpers in `utils.ts`** (`isAngular()`, `isVue()`, etc.) are for `dependencies.ts` only — never use them in generators or adapter code.
- **Adding a `tests/configs/*.config.ts` without a matching `generate:` script** in `tests/package.json`. `generate-api` is `run-p 'generate:*'`, so a config with no script is generated by nobody and snapshot-checked by nobody. Every config has one today; keep it that way when you add a framework.
