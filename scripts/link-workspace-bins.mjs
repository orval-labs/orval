import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';

const isWindows = platform() === 'win32';
const orvalBin = resolve('packages/orval/dist/bin/orval.mjs');

function linkOrval(binDir) {
  mkdirSync(binDir, { recursive: true });
  const link = join(binDir, isWindows ? 'orval.cmd' : 'orval');

  try {
    lstatSync(link);
    unlinkSync(link);
  } catch {}

  if (isWindows) {
    writeFileSync(link, `@node "${orvalBin}" %*\r\n`);
  } else {
    symlinkSync(orvalBin, link);
  }
}

function findBinDirs(dir, depth = 0) {
  if (depth > 5) return [];
  const dirs = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.name === 'node_modules') {
        const binDir = join(fullPath, '.bin');
        if (existsSync(binDir)) dirs.push(binDir);
      } else {
        dirs.push(...findBinDirs(fullPath, depth + 1));
      }
    }
  } catch {}

  return dirs;
}

// Link in root
linkOrval(join('node_modules', '.bin'));

// Link in all workspace node_modules/.bin directories
for (const wsRoot of ['packages', 'samples', 'tests', 'docs']) {
  if (existsSync(wsRoot)) {
    for (const binDir of findBinDirs(wsRoot)) {
      linkOrval(binDir);
    }
  }
}
