import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'api', 'models'),
    path.resolve(import.meta.dirname, 'api', 'pets'),
    path.resolve(import.meta.dirname, 'api', 'owners'),
    path.resolve(import.meta.dirname, 'api', 'species'),
    path.resolve(import.meta.dirname, 'api', 'shelters'),
  ],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__', 'api'),
  rootDir,
});
