Nice issue to tackle — I dug through the issue + related threads, compared `angular` vs `angular-query` paths in this branch, and checked current Zod docs behavior.

## What I found

- **Issue #2945 is valid and still open**: `angular-query` supports runtime validation, plain `angular` does not.
- In your codebase:
  - `packages/query/src/client.ts` already applies runtime validation for Angular query HTTP calls via:
    - `override.query.runtimeValidation`
    - `isZodOutput`
    - skip primitive responses
    - skip when schema import missing
    - `Schema.parse(...)` in RxJS pipeline
    - `Error` schema alias handling (`ErrorSchema`)
  - `packages/angular/src/index.ts` has **no equivalent runtime validation logic**.
- Type/config gap:
  - `AngularOptions` in `packages/core/src/types.ts` currently only has `provideIn`.
  - Normalization in `packages/orval/src/utils/options.ts` only normalizes `override.angular.provideIn`.
  - So there is no typed/normalized place for `override.angular.runtimeValidation`.
- Docs currently describe runtime validation under `override.query.runtimeValidation` (Angular query guide + config docs), but not plain Angular.
- Related issues/PRs confirm this is consistent with recent architecture:
  - #2927 added Angular-query runtime validation
  - #2938/#2941 hardened Angular typing/imports/filtering and are relevant constraints, not blockers
  - #2858 confirms custom mutator bypass is known behavior (and should stay explicit)

## Zod docs check (what to use)

From current Zod docs:

- `.parse()` = validates and **throws `ZodError`** on failure
- `.safeParse()` = returns discriminated union (`{ success, data|error }`)
- Async refinements/transforms require `.parseAsync()` / `.safeParseAsync()`

## Standard Schema check (and whether we should use it now)

From Standard Schema docs (`@standard-schema/spec`):

- A compliant schema exposes `schema['~standard'].validate(input)`
- Validation returns `{ value }` on success or `{ issues }` on failure
- `validate` can be sync or async (`Result | Promise<Result>`)
- This is vendor-neutral and works across libraries (Zod, Valibot, ArkType, etc.)

Practical implication for this issue:

- **Yes, keep Standard Schema in mind.**
- **No, don’t switch #2945 implementation to Standard Schema-first yet.**

Reasoning:

- #2945 explicitly targets Zod parity and current Orval behavior already uses direct Zod `.parse()` in query/fetch runtime validation.
- Switching now to a generic Standard Schema adapter would broaden scope (new errors, async handling, typing shape, compatibility matrix), which is better as a follow-up.
- But we should implement with a **small internal abstraction seam** so Standard Schema can be added without reworking Angular codegen logic.

### Recommendation for Orval generator behavior

Use **`.parse()`** (same as current query/fetch runtime-validation style), because:

- keeps generated path simple/fail-fast
- matches existing runtimeValidation semantics in repo
- preserves return type shape (no success/error wrapper handling needed)
- no async refinements are generated in Orval-produced schemas, so sync parse is appropriate

Additionally:

- Keep an internal helper shape in mind for future migration, e.g. `validateResponse(schemaRef, data)`.
- Initial implementation can be Zod-only under the hood (`schema.parse(data)`), while making later Standard Schema support additive.

## Angular 21 readiness check (httpResource.parse + Signal Forms)

From Angular docs:

- `httpResource` has a `parse` option in `HttpResourceOptions` to transform/validate runtime responses.
- Angular docs explicitly mention using runtime schema validators (including Zod) via `parse`.
- `httpResource` is still marked **experimental**.
- Signal Forms are also **experimental** in Angular 21.

Practical implication for this issue:

- **Correct:** we should prepare for that direction.
- But for this PR, keep scope on current `client: 'angular'` HttpClient codegen parity.
- Add a forward-compatible design note so a future `httpResource`/Signal Forms-focused output mode can reuse the same validation strategy.

## Recommended implementation shape for `client: 'angular'`

I’d implement exactly this scope for #2945:

1. Add `runtimeValidation?: boolean` to `AngularOptions` (and normalized path).
2. Normalize `override.angular.runtimeValidation` (default `false`) in options normalization.
3. In `packages/angular/src/index.ts`:
   - gate validation on:
     - `override.angular.runtimeValidation`
     - Zod schemas output (`schemas.type === 'zod'`)
     - non-primitive/void response
     - response schema import exists

- implement through a small local validation helper seam (still Zod-only for now)
- skip mutator path (existing behavior pattern)
- skip non-body observe (`events` / `response`)
- for multi-content responses, only validate JSON branch
- keep `Error` alias safeguard (`ErrorSchema`) when needed

4. Ensure schema import promotion to value import when parse is needed (same pattern used in fetch/query client builders).
5. Add focused tests in `packages/angular/src/index.test.ts`:
   - parses on body mode
   - skips events/response
   - skips primitive/void
   - skips custom mutator
   - handles `ErrorSchema` alias safely
6. Update docs with support matrix + config examples.

## Should this be implemented for other packages too?

Short answer: **not in the same PR**, but yes to a roadmap.

- **Do now (this issue)**: plain `angular` parity with `angular-query`.
- **Already supported**: `fetch` (`override.fetch.runtimeValidation`).
- **Candidate next**: broader query-family parity (`react-query`, `vue-query`, `svelte-query`, `solid-query`) under `override.query.runtimeValidation`, especially when using fetch/http paths that can be validated centrally.
- **Keep separate**: custom mutator schema-pass-through (#2858) should remain a dedicated feature decision.

So I’d recommend:

- PR A: `angular` parity + docs matrix
- PR B: cross-query runtimeValidation unification (if desired by maintainers)
- PR C: optional Standard Schema support layer (vendor-neutral runtime validation), with docs for Zod/Valibot interoperability and explicit sync/async behavior

## Suggested docs/support matrix update

Add a compact matrix in docs clarifying:

- `fetch`: runtimeValidation ✅ (Zod)
- `angular-query`: runtimeValidation ✅ (Zod)
- `angular`: runtimeValidation ✅ after #2945 (Zod)
- custom mutator paths: limited/bypassed unless explicitly handled (link #2858)
- Standard Schema: planned/future (not the default behavior yet)
- Angular `httpResource.parse`: related direction, currently experimental ecosystem APIs
