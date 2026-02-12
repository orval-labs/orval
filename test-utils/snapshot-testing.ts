import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, test } from 'vitest';

async function getAllGeneratedFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await getAllGeneratedFiles(fullPath);
      files.push(...nested);
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

interface SnapshotTestingParams {
  /** Directories to scan recursively. Each dir's basename is used as the snapshot subdirectory. */
  dirs?: string[];
  /** Individual file paths. Each file's basename is used as the snapshot filename. */
  files?: string[];
  /** Directory to store snapshots. */
  snapshotsDir: string;
  /** Root directory of the monorepo. Used to make relative paths test output. */
  rootDir: string;
}

export async function describeApiGenerationSnapshots({
  dirs,
  files,
  snapshotsDir,
  rootDir,
}: SnapshotTestingParams) {
  // [displayName, filePath, snapshotPath]
  const testCases: [string, string, string][] = [];

  if (dirs) {
    for (const dir of dirs) {
      const sub = path.basename(dir);
      const dirFiles = await getAllGeneratedFiles(dir);
      for (const f of dirFiles) {
        const rel = path.relative(dir, f);
        testCases.push([
          path.relative(rootDir, f),
          f,
          path.join(snapshotsDir, sub, rel),
        ]);
      }
    }
  }

  if (files) {
    for (const file of files) {
      testCases.push([
        path.relative(rootDir, file),
        file,
        path.join(snapshotsDir, path.basename(file)),
      ]);
    }
  }

  const expectedSnapshotPaths = new Set(
    testCases.map((tc) => path.relative(snapshotsDir, tc[2])),
  );

  describe('API Generation Snapshots', () => {
    test.for(testCases)(
      '%s',
      async ([, filePath, snapshotPath], { expect }) => {
        const content = await readFile(filePath, 'utf8');
        await expect(content).toMatchFileSnapshot(snapshotPath);
      },
    );

    test('should have no orphaned snapshots', async ({ expect }) => {
      // @ts-expect-error -- _updateSnapshot is private
      if (expect.getState().snapshotState._updateSnapshot === 'all') return;

      let snapshotFiles: string[] = [];
      try {
        snapshotFiles = await getAllGeneratedFiles(snapshotsDir);
      } catch {
        return;
      }
      const orphaned = snapshotFiles
        .map((f) => path.relative(snapshotsDir, f))
        .filter((f) => !expectedSnapshotPaths.has(f));
      expect(
        orphaned,
        'Orphaned snapshot files with no matching generated file',
      ).toEqual([]);
    });
  });
}
