import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../../test-utils/snapshot-testing';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');
const snapshotsDir = path.resolve(import.meta.dirname, '__snapshots__');

await describeApiGenerationSnapshots({
  dirs: [path.resolve(import.meta.dirname, 'hono-app', 'src', 'handlers')],
  files: [
    path.resolve(import.meta.dirname, 'hono-app', 'src', 'petstore.ts'),
    path.resolve(import.meta.dirname, 'hono-app', 'src', 'petstore.context.ts'),
    path.resolve(import.meta.dirname, 'hono-app', 'src', 'petstore.schemas.ts'),
    path.resolve(
      import.meta.dirname,
      'hono-app',
      'src',
      'petstore.validator.ts',
    ),
    path.resolve(import.meta.dirname, 'hono-app', 'src', 'petstore.zod.ts'),
  ],
  snapshotsDir: path.resolve(snapshotsDir, 'hono-app'),
  rootDir,
});

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'next-app', 'app', 'gen', 'pets'),
    path.resolve(import.meta.dirname, 'next-app', 'app', 'gen', 'models'),
  ],
  snapshotsDir: path.resolve(snapshotsDir, 'next-app'),
  rootDir,
});
