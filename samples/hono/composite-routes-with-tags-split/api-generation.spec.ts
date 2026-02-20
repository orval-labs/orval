import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'src', 'endpoints'),
    path.resolve(import.meta.dirname, 'src', 'schemas'),
  ],
  files: [path.resolve(import.meta.dirname, 'src', 'routes.ts')],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..', '..'),
});
