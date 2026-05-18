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
