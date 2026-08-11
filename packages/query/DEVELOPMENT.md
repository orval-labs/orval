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

## Snapshot Coverage

Every framework this package targets is snapshot covered, Solid included: `tests/configs/solid-query.config.ts` and `tests/configs/solid-start.config.ts` each have a `generate:` script in `tests/package.json`, and `tests/api-generation.spec.ts` asserts their output against `tests/__snapshots__/solid-query/` and `tests/__snapshots__/solid-start/`.

So a change to `withDefaults()` or to a shared generator shows up as a snapshot diff for all five frameworks. Run `vp run -w test:snapshots:update` and read the diff before committing.

Two known defects keep some generated Solid files out of `tests/scripts/typecheck-generated.mjs`. They are listed with their cause in `excludedByFolder` in that script:

- solid-query infinite hooks are missing `initialPageParam` and `getNextPageParam`, because `shouldCastQueryOptions()` returns `false` for Solid and that also strips the cast from the infinite path.
- solid-start names its namespace object after the pascal-cased tag, which collides with a schema of the same name.

The snapshots still capture the broken output, so a fix shows up as a diff. Delete the matching entry when you fix one.

## Common Pitfalls

- **Forgetting `vp run update-samples`** after changing generation logic — CI will catch stale samples as a diff.
- **Testing only one framework** after changing `withDefaults()` or shared generators — regressions in other frameworks won't be caught.
- **Adding `if (isAngular)` in shared generators** — use adapter methods instead. The FrameworkAdapter pattern exists to avoid framework conditionals in shared code.
- **Framework detection helpers in `utils.ts`** (`isAngular()`, `isVue()`, etc.) are for `dependencies.ts` only — never use them in generators or adapter code.
- **Adding a `tests/configs/*.config.ts` without a matching `generate:` script** in `tests/package.json`. `generate-api` is `run-p 'generate:*'`, so a config with no script is generated by nobody and snapshot-checked by nobody. Every config has one today; keep it that way when you add a framework.
