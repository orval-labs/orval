import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'vitest';

import { describeApiGenerationSnapshots } from '../test-utils/snapshot-testing';

const generated = (...segments: string[]) =>
  path.resolve(import.meta.dirname, 'generated', ...segments);

await describeApiGenerationSnapshots({
  dirs: [
    generated('angular'),
    generated('angular-query'),
    generated('axios'),
    generated('cli'),
    generated('default'),
    generated('fetch'),
    generated('hono'),
    generated('mcp'),
    generated('mock'),
    generated('multi-files'),
    generated('react-query'),
    generated('svelte-query'),
    generated('swr'),
    generated('vue-query'),
    generated('zod'),
  ],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..'),
});

test('angular issue-3103 emits filterParams in tags-split default service', async () => {
  // Keep this focused assertion alongside the snapshot so #3103 fails with a
  // targeted message instead of a full-file snapshot diff.
  const defaultServiceFile = generated(
    'angular',
    'issue-3103',
    'default',
    'default.service.ts',
  );
  const content = await readFile(defaultServiceFile, 'utf8');

  expect(content).toContain('export class DefaultService');
  expect(content).toContain('function filterParams(');
  expect(content).toContain('const filteredParams = filterParams(');
});

test('angular issue-3326 keeps the default filter type-safe (no passthrough)', async () => {
  // Without a paramsSerializer/paramsFilter there is no consumer that can
  // handle a raw object, and Angular's HttpParams only accepts primitives.
  // The built-in filter must NOT emit a passthrough set here — doing so
  // makes filterParams return `unknown`, which fails to compile against
  // HttpClient. The object param is dropped instead. See #3326.
  // Compilation of this fixture is enforced by scripts/typecheck-generated.mjs.
  const file = generated('angular', 'issue-3326', 'endpoints.ts');
  const content = await readFile(file, 'utf8');

  expect(content).toContain('function filterParams(');
  expect(content).not.toContain("new Set<string>(['filters'])");
});

test('angular issue-3326 passes object params through to a paramsSerializer', async () => {
  // With a paramsSerializer that can consume the raw object, the schema-
  // declared object param survives the built-in filter via the passthrough
  // set instead of being dropped. See #3326.
  const file = generated('angular', 'issue-3326-serializer', 'endpoints.ts');
  const content = await readFile(file, 'utf8');

  expect(content).toContain('function filterParams(');
  expect(content).toContain("new Set<string>(['filters'])");
  expect(content).toContain('customParamsSerializer(');
});

test('angular issue-3326 paramsFilter replaces the built-in filter', async () => {
  const file = generated('angular', 'issue-3326-filter', 'endpoints.ts');
  const content = await readFile(file, 'utf8');

  // The user mutator is imported and called; the built-in helper is gone.
  expect(content).toContain('flattenParamsFilter');
  expect(content).not.toContain('function filterParams(');
});

test('react-query issue-708 isolates the infinite query key from the regular one', async () => {
  // Regression for #708: an operation generated as both a regular and an
  // infinite query must not share a query key, otherwise React Query serves
  // one query's cached data for the other. Keep this focused assertion
  // alongside the snapshot so #708 fails with a targeted message instead of a
  // full-file snapshot diff.
  const content = await readFile(
    generated('react-query', 'issue-708', 'endpoints.ts'),
    'utf8',
  );

  // Slices out a single `getGetList[Infinite]QueryKey` declaration.
  const queryKeyFn = (variant: 'Infinite' | '') => {
    const marker = `getGetList${variant}QueryKey = (`;
    const start = content.indexOf(marker);
    expect(start, `${marker} should be generated`).toBeGreaterThan(-1);
    const end = content.indexOf('as const', start);
    expect(end, `${marker} body should be terminated`).toBeGreaterThan(start);
    return content.slice(start, end);
  };

  // Both key fns must exist as separate functions.
  expect(content).toContain('getGetListInfiniteQueryKey = (');
  expect(content).toContain('getGetListQueryKey = (');

  // The infinite key carries an 'infinite' segment; the regular one must not,
  // otherwise the two query keys would be identical and collide in the cache.
  expect(queryKeyFn('Infinite')).toContain("'infinite'");
  expect(queryKeyFn('')).not.toContain("'infinite'");

  // Each hook must consume its own key fn. Assert on the full `queryKey`
  // assignment rather than the bare call: `getGetListQueryKey(params)` is a
  // suffix of `getGetListInfiniteQueryKey(params)`, so a bare-call check would
  // pass even if the regular hook never invoked its own key fn.
  expect(content).toContain(
    'queryOptions?.queryKey ?? getGetListInfiniteQueryKey(params)',
  );
  expect(content).toContain(
    'queryOptions?.queryKey ?? getGetListQueryKey(params)',
  );
});

test('default issue-826 wraps bodies whose readonly props come from nested schemas', async () => {
  // Regression for #826: an object schema with no direct `readOnly` property
  // but a property referencing a schema that does have readonly props must
  // still wrap the request body in `NonReadonly<>`, otherwise the nested
  // readonly modifier leaks into the request type. Keep this focused assertion
  // alongside the snapshot so #826 fails with a targeted message instead of a
  // full-file snapshot diff.
  const content = await readFile(
    generated('default', 'readonly', 'endpoints.ts'),
    'utf8',
  );

  expect(content).toContain(
    'nestedReadonlyObject?: NonReadonly<NestedReadonlyObject>',
  );
});

test('default issue-873 does not duplicate multi-tag operations across tag files', async () => {
  // Regression for #873: an operation declaring multiple tags
  // (`listPets` has `tags: [cats, dogs]` in multiple-tags.yaml) must be
  // emitted only under its first tag. Emitting it under every tag duplicated
  // the operation across tag files and made the workspace index re-export the
  // same symbol twice, so the generated code failed to compile. Keep this
  // focused assertion alongside the snapshot so #873 fails with a targeted
  // message instead of a full-file snapshot diff.
  const marker = 'export const listPets = (';

  // [mode, first-tag file, later-tag file]
  const modes = [
    ['multiple-tags', ['cats.ts'], ['dogs.ts']],
    ['multiple-tags-split', ['cats', 'cats.ts'], ['dogs', 'dogs.ts']],
  ] as const;

  for (const [mode, firstTag, laterTag] of modes) {
    const firstTagContent = await readFile(
      generated('default', mode, ...firstTag),
      'utf8',
    );
    const laterTagContent = await readFile(
      generated('default', mode, ...laterTag),
      'utf8',
    );

    expect(
      firstTagContent,
      `${mode}: listPets should be emitted under its first tag`,
    ).toContain(marker);
    expect(
      laterTagContent,
      `${mode}: listPets must not be duplicated into a later tag`,
    ).not.toContain(marker);
  }
});

test('vue-query issue-1026 keeps header params out of the query key getter', async () => {
  // Regression for #1026: with `headers: true` the Vue Query key getter used to
  // emit `headers = unref(headers);` even though `headers` is not one of its
  // parameters, throwing `ReferenceError: headers is not defined` at runtime.
  // The getter must never unref params (that would also break key reactivity);
  // `headers` is only unref'd inside the HTTP function where it is a parameter.
  // Keep this focused assertion alongside the snapshot so #1026 fails with a
  // targeted message instead of a full-file snapshot diff.
  const content = await readFile(
    generated('vue-query', 'issue-1026', 'endpoints.ts'),
    'utf8',
  );

  // Slice out the `getGetSomeEndpointQueryKey` declaration body.
  const marker = 'export const getGetSomeEndpointQueryKey = (';
  const start = content.indexOf(marker);
  expect(start, `${marker} should be generated`).toBeGreaterThan(-1);
  const end = content.indexOf('as const', start);
  expect(end, `${marker} body should be terminated`).toBeGreaterThan(start);
  const queryKeyFn = content.slice(start, end);

  // The getter must not reference `headers` as an identifier: that was the
  // #1026 bug (`headers = unref(headers);`) and unref-ing a param would also
  // break query-key reactivity. A word-boundary regex keeps the intent precise
  // rather than matching `headers` as a loose substring.
  expect(queryKeyFn).not.toMatch(/\bheaders\b/);

  // Sanity check: the HTTP function still receives and unrefs `headers`, so the
  // assertion above is not passing simply because headers support is missing.
  expect(content).toContain('headers?: MaybeRef<GetSomeEndpointHeaders>');
  expect(content).toContain('headers = unref(headers);');
});

test('fetch useDates with only date-time query params coerces via String(value)', async () => {
  // Regression: with `useDates: true` and every param typed `Date`, the old
  // URL builder emitted `value.toString()` as the non-Date fallback. TS
  // narrowed that branch to `never`, and at runtime it called
  // `Date.prototype.toString()` (local string) instead of `toISOString()`.
  // The fallback must coerce via `String(value)`.
  const file = (...segments: string[]) =>
    readFile(
      generated('fetch', 'usedates-only-date-params', ...segments),
      'utf8',
    );
  const endpoints = await file('endpoints.ts');
  const paramsModel = await file('model', 'thingsListParams.ts');

  expect(paramsModel).toMatch(/start_time\??:\s*Date/);
  expect(paramsModel).toMatch(/end_time\??:\s*Date/);

  expect(endpoints).toContain('String(value)');
  expect(endpoints).not.toContain('value.toString()');
  expect(endpoints).toMatch(
    /value instanceof Date\s*\?\s*value\.toISOString\(\)/,
  );
});

test('vue-query custom fetch infinite queries unref non-pagination params', async () => {
  // Regression for #3385:
  // functions accept plain values, while Vue query hooks expose MaybeRef<T>.
  // The infinite query path already unwraps `params` to merge the page param,
  // but must also unwrap the remaining props before calling the request
  // function or the generated output fails TypeScript compilation.
  const content = await readFile(
    generated('vue-query', 'infinite-query-with-custom-fetch', 'endpoints.ts'),
    'utf8',
  );

  expect(content).toContain(
    `getUsersUserIdOrders(
      unref(userId),
      { ...unref(params), limit: pageParam ?? unref(params)?.['limit'] },
      { signal, ...requestOptions },
    );`,
  );
});

test('default issue-1107 emits exports for schemas defined via cross-file $ref', async () => {
  // Regression for #1107: a top-level `components.schemas.X` that is itself a
  // cross-file `$ref` (X -> another file's X) used to generate a schema file
  // with the import but no `export` for X, producing a dangling, unusable
  // module. Each referenced schema must still be a usable exported type.
  // Keep this focused assertion alongside the snapshot so #1107 fails with a
  // targeted message instead of a full-file snapshot diff.
  const model = (file: string) =>
    readFile(
      generated('default', 'issue-1107-cross-file-ref', 'model', file),
      'utf8',
    );

  // Object schemas reached through a cross-file `$ref` are exported as types.
  expect(await model('pet.ts')).toContain('export interface Pet {');
  expect(await model('error.ts')).toContain('export interface Error {');

  // The array schema both imports its item type and exports its own alias;
  // the missing `export type` line was the #1107 bug.
  const pets = await model('pets.ts');
  expect(pets).toContain("import type { Pet } from './pet';");
  expect(pets).toContain('export type Pets = Pet[];');
});

test('default issue-3380 resolves external path-item $refs with escaped pointers', async () => {
  // Regression for #3380: path items defined via a cross-file `$ref`
  // (`#/paths/~1pets` and `#/paths/~1pets~1%7BpetId%7D`) used to abort
  // generation with "Can't resolve reference" because the JSON Pointer escape
  // `~1` and percent-encoding `%7B`/`%7D` were not decoded before resolving
  // the external document. Both operations must now be generated.
  // Keep this focused assertion alongside the snapshot so #3380 fails with a
  // targeted message instead of a full-file snapshot diff.
  const content = await readFile(
    generated('default', 'issue-3380-external-path-ref', 'endpoints.ts'),
    'utf8',
  );

  expect(content).toContain('export const listPets = (');
  expect(content).toContain('export const getPet = (');
  // The templated path ref (`~1pets~1%7BpetId%7D`) decodes to `/pets/{petId}`.
  expect(content).toContain('`/pets/${petId}`');
});

test('react-query issue-1522 passes the enabled option into the queryOptions mutator', async () => {
  // Regression for #1522: when `allParamsOptional` and a custom `queryOptions`
  // mutator are combined, the auto-generated `enabled` guard (which disables
  // the query while the required `houseId` path param is nullish) used to be
  // dropped because the mutator received `{ ...queryOptions, queryKey,
  // queryFn }` instead of the full options object. The query then fired with
  // an `undefined` path param. Keep this focused assertion alongside the
  // snapshot so #1522 fails with a targeted message instead of a full-file
  // snapshot diff.
  const content = await readFile(
    generated('react-query', 'issue-1522', 'endpoints.ts'),
    'utf8',
  );

  // The mutator must receive the full generated options object: `queryKey`,
  // `queryFn`, the `enabled` guard for the required `houseId` path param, and
  // `...queryOptions` last so callers can still override it. Generation is
  // deterministic, so match the whole call verbatim instead of slicing on
  // `});` (a nested call site in the argument could otherwise truncate it).
  const expectedMutatorCall = [
    '  const customOptions = customQueryOptions({',
    '    queryKey,',
    '    queryFn,',
    '    enabled: houseId !== null && houseId !== undefined,',
    '    ...queryOptions,',
    '  });',
  ].join('\n');

  // One occurrence for the regular query helper, one for the infinite one.
  const occurrences = content.split(expectedMutatorCall).length - 1;
  expect(occurrences).toBe(2);
});

test('fetch issue-1879 inlines header schema when $ref targets another path parameter', async () => {
  // Regression for #1879: a header parameter referenced via a JSON Pointer
  // `$ref` to another path's parameter
  // (`#/paths/~1requestA/post/parameters/0`) used to be typed as `N0` (the
  // sanitized last segment of the ref) and imported from a non-existent
  // `./n0` module, because the resolver's synthesized name leaked downstream
  // even though `generateParameterDefinition` only emits types for slots
  // under `#/components/parameters/*`. The fix gates that import on
  // `isComponentRef` so non-component refs inline the resolved parameter's
  // schema (`string`) instead. Keep this focused assertion alongside the
  // snapshot so #1879 fails with a targeted message rather than a full-file
  // snapshot diff.
  const headersContent = await readFile(
    generated('fetch', 'issue-1879', 'model', 'requestBHeaders.ts'),
    'utf8',
  );

  // The header type must be inlined as `string` with no dangling reference.
  expect(headersContent).toContain("'Content-Type'?: string;");
  expect(headersContent).not.toMatch(/\bN0\b/);
  expect(headersContent).not.toContain('./n0');

  // And no synthesized `n0` module should be emitted alongside it.
  const indexContent = await readFile(
    generated('fetch', 'issue-1879', 'model', 'index.ts'),
    'utf8',
  );
  expect(indexContent).not.toMatch(/\bn0\b/);
});
