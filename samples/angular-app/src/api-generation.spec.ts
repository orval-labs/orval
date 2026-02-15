import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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

const apiDir = path.resolve(import.meta.dirname, 'api');
const snapshotsDir = path.resolve(import.meta.dirname, '..', '__snapshots__');
const allFiles = await getAllGeneratedFiles(apiDir);

describe('API Generation Snapshots', () => {
  it('should have no stale snapshots', async () => {
    const apiRelPaths = allFiles
      .map((f) => path.relative(apiDir, f))
      .toSorted();
    const snapshotFiles = await getAllGeneratedFiles(snapshotsDir);
    const snapshotRelPaths = snapshotFiles
      .map((f) => path.relative(snapshotsDir, f))
      .toSorted();
    expect(snapshotRelPaths).toEqual(apiRelPaths);
  });

  it.each(allFiles)('%s', async (filePath) => {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = path.relative(apiDir, filePath);
    await expect(content).toMatchFileSnapshot(
      path.join('..', '__snapshots__', relativePath),
    );
  });
});
