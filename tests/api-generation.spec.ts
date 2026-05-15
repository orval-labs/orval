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

test('angular issue-3326 preserves object query params through default filter', async () => {
  // Schema-declared object params must survive the built-in filterParams so a
  // downstream paramsSerializer/mutator can handle them. See #3326.
  const file = generated('angular', 'issue-3326', 'endpoints.ts');
  const content = await readFile(file, 'utf8');

  expect(content).toContain('function filterParams(');
  // The object-typed `filters` key is forwarded as a passthrough set.
  expect(content).toContain("new Set<string>(['filters'])");
});

test('angular issue-3326 paramsFilter replaces the built-in filter', async () => {
  const file = generated('angular', 'issue-3326-filter', 'endpoints.ts');
  const content = await readFile(file, 'utf8');

  // The user mutator is imported and called; the built-in helper is gone.
  expect(content).toContain('flattenParamsFilter');
  expect(content).not.toContain('function filterParams(');
});
