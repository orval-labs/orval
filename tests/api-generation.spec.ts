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
