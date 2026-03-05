import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [path.resolve(import.meta.dirname, 'src', 'http-schemas')],
  files: [path.resolve(import.meta.dirname, 'src', 'handlers.ts')],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..', '..'),
});
