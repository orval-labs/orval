import {
  mkdirSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { execSync } from 'node:child_process';

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

// Always link in root
linkOrval(join('node_modules', '.bin'));

// Find and link in all workspace node_modules/.bin directories
if (!isWindows) {
  try {
    const dirs = execSync(
      "find . -path '*/node_modules/.bin' -not -path './node_modules/.bin' -not -path '*/node_modules/*/node_modules/*' -type d",
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    for (const dir of dirs) {
      linkOrval(dir);
    }
  } catch {}
}
