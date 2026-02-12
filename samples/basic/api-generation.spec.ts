import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'api', 'endpoints'),
    path.resolve(import.meta.dirname, 'api', 'model'),
  ],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..'),
});
