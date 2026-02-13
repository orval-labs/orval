# Plan: Fix MSW mixed JSON/XML/text response content-type mismatch

**TL;DR:** When an OpenAPI endpoint declares mixed content types (e.g. `text/plain` + `application/xml` + `application/json`) with different schemas per type, the generated MSW handler picks a single `HttpResponse.*` helper at code-generation time. Because `shouldPreferJsonResponse` is defeated by union return types containing `string` (e.g. `string | Pet`), the handler may route to `HttpResponse.text()` or `HttpResponse.xml()` while the mock function returns an object — producing a JSON-stringified body under the wrong Content-Type. The fix: generate **runtime branching** so the response helper is selected based on the actual resolved value's type.

## Root cause trace

In `packages/mock/src/msw/index.ts` (lines 149-157):

- `hasStringReturnType` uses `.includes('string')`, which matches union types like `string | Pet`
- This forces `shouldPreferJsonResponse = false`
- The condition `isTextResponse && !shouldPreferJsonResponse` (line ~210) evaluates to `true`
- The text branch generates `HttpResponse.text(textBody)` where `textBody = JSON.stringify(resolvedBody)` for objects
- Result: a JSON body served with `text/plain` or `text/xml` Content-Type

Confirmed affected spec pattern: the angular-app `showPetById` endpoint in `samples/angular-app/petstore.yaml` (lines 136-148) defines `text/plain` (string), `application/xml` (Pet), and `application/json` (Pet) as 200 response content types.

## MSW best practices

From the MSW documentation (https://mswjs.io/docs/api/http-response), each static method sets a specific `Content-Type`:

- `HttpResponse.json()` → `application/json`
- `HttpResponse.text()` → `text/plain`
- `HttpResponse.xml()` → `text/xml` (note: MSW uses `text/xml`, not `application/xml`)
- `HttpResponse.html()` → `text/html`

The body type must match the helper: `HttpResponse.json()` accepts objects, while `.text()/.xml()/.html()` accept strings only. Passing a JSON-stringified object to `.xml()` is semantically incorrect.

## Steps

### 1. Add runtime content-type detection flag

In `generateDefinition` at `packages/mock/src/msw/index.ts` (lines 149-157):

- Compute `needsRuntimeContentTypeSwitch = isTextResponse && hasJsonContentType && hasStringReturnType && mockReturnType !== 'string'`
- This activates only for genuine union types like `string | Pet`, not plain `string`

### 2. Update `responsePrelude`

At `packages/mock/src/msw/index.ts` (lines 169-175):

- When `needsRuntimeContentTypeSwitch` is true, generate only the `resolvedBody` evaluation (no `textBody` conversion):
  ```
  const resolvedBody = ${resolvedResponseExpr};
  ```
- Insert this as a new branch before the existing `isTextResponse && !shouldPreferJsonResponse` check

### 3. Update `responseBody`

At `packages/mock/src/msw/index.ts` (lines 208-231):

- When `needsRuntimeContentTypeSwitch` is true, generate a ternary branching on `typeof resolvedBody === 'string'`:
  - String case → use the appropriate text helper (`HttpResponse.text/xml/html`) based on `firstTextCt` (same logic as current text branch)
  - Object case → use `HttpResponse.json(resolvedBody, { status })`
- This requires computing `textHelper` (xml/html/text) identically to the existing text branch

### 4. Add regression tests

In `packages/mock/src/msw/index.test.ts`:

- **Test A**: Mixed `['text/plain', 'application/xml', 'application/json']` with return type `string | Pet` → should generate runtime branching (`typeof resolvedBody === 'string'`), both `HttpResponse.text()` and `HttpResponse.json()` present
- **Test B**: Mixed `['application/xml', 'application/json']` with return type `string | Pet` → runtime branching, `HttpResponse.xml()` for string case, `HttpResponse.json()` for object case
- **Test C**: Mixed `['application/xml', 'application/json']` with return type `Pet` only → NO runtime branching, uses `HttpResponse.json()` directly (existing `shouldPreferJsonResponse` handles this — verify no regression)
- **Test D**: Single `['text/plain']` with return type `string` → NO runtime branching, uses `HttpResponse.text()` as before (verify no regression)
- **Test E**: Mixed `['text/plain', 'application/json']` with return type `string` (not union) → NO runtime branching, uses `HttpResponse.text()` as before
- **Test F**: Mixed with `preferredContentType: 'application/json'` and union return type → NO runtime branching, `preferredContentType` narrows `contentTypesByPreference` to JSON only

### 5. Regenerate sample MSW files

Verify the fix produces correct output for:

- `samples/angular-app/src/api/endpoints/pets/pets.msw.ts` — `showPetById` should now have runtime branching
- `samples/angular-query/src/api/endpoints/pets/pets.msw.ts` — `showPetById` and `listPets` should use `HttpResponse.json()` (return type is `Pet`/`Pet[]`, not a union with string)

## Verification

- Run `npx vitest packages/mock` to execute existing + new tests
- Inspect generated handler output in test snapshots for the expected patterns:
  - Runtime branch: `typeof resolvedBody === 'string' ? HttpResponse.text(...) : HttpResponse.json(...)`
  - No `JSON.stringify` + `HttpResponse.xml()` combination for object payloads
- Regenerate samples (`npx orval` in sample dirs) and visually verify the `showPetById` handler in angular-app

## Decisions

- **Runtime branching over static selection**: Chose to generate an `if typeof === 'string'` ternary in the handler output rather than always picking JSON for union types. This preserves correct Content-Type for string payloads while using JSON for structured types.
- **Guard condition `mockReturnType !== 'string'`**: Avoids unnecessary runtime branching when the type is unambiguously `string` — the text branch is already correct there.
- **No changes to `mocks.ts`**: The mock value generation is content-type-agnostic by design. The fix belongs entirely in the handler generation logic in `index.ts`.
