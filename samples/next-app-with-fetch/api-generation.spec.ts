import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'app', 'gen', 'pets'),
    path.resolve(import.meta.dirname, 'app', 'gen', 'models'),
  ],
  files: [path.resolve(import.meta.dirname, 'app', 'gen', 'index.msw.ts')],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..'),
});
