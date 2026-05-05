import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'vitest';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [path.resolve(import.meta.dirname, 'src', 'api')],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..'),
});

test('tags-split Angular Query emits filterParams only for tags with query params', async () => {
  const healthFile = path.resolve(
    import.meta.dirname,
    'src',
    'api',
    'endpoints-zod',
    'health',
    'health.ts',
  );
  const petsFile = path.resolve(
    import.meta.dirname,
    'src',
    'api',
    'endpoints-zod',
    'pets',
    'pets.ts',
  );

  const [healthContent, petsContent] = await Promise.all([
    readFile(healthFile, 'utf8'),
    readFile(petsFile, 'utf8'),
  ]);

  expect(
    healthContent,
    'health tag output should not emit the Angular filterParams helper',
  ).not.toContain('function filterParams(');
  expect(
    petsContent,
    'pets tag output should keep the Angular filterParams helper',
  ).toContain('function filterParams(');
});
