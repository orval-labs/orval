import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [path.resolve(import.meta.dirname, 'src', 'handlers')],
  files: [
    path.resolve(import.meta.dirname, 'src', 'petstore.ts'),
    path.resolve(import.meta.dirname, 'src', 'petstore.context.ts'),
    path.resolve(import.meta.dirname, 'src', 'petstore.schemas.ts'),
    path.resolve(import.meta.dirname, 'src', 'petstore.validator.ts'),
    path.resolve(import.meta.dirname, 'src', 'petstore.zod.ts'),
  ],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..', '..'),
});
