import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

await describeApiGenerationSnapshots({
  dirs: [
    path.resolve(import.meta.dirname, 'api', 'models'),
    path.resolve(import.meta.dirname, 'api', 'Pets'),
    path.resolve(import.meta.dirname, 'api', 'Owners'),
    path.resolve(import.meta.dirname, 'api', 'Species'),
    path.resolve(import.meta.dirname, 'api', 'Shelters'),
  ],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__', 'api'),
  rootDir,
});
