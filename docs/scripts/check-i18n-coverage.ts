import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const docsDir = join(import.meta.dirname, '..', 'content', 'docs');
const zhDir = join(docsDir, 'zh');
const checkedExtensions = new Set(['.mdx', '.json']);

function listFiles(dir: string, baseDir = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'zh') return [];
      return listFiles(path, baseDir);
    }

    if (
      ![...checkedExtensions].some((extension) =>
        entry.name.endsWith(extension),
      )
    ) {
      return [];
    }

    return relative(baseDir, path);
  });
}

const missing = listFiles(docsDir).filter((file) => {
  return !existsSync(join(zhDir, file));
});

if (missing.length > 0) {
  console.error('Missing zh documentation files:');
  for (const file of missing) {
    console.error(`- docs/content/docs/zh/${file}`);
  }
  process.exit(1);
}

console.log('All zh documentation files are present.');
