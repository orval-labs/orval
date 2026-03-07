import {
  mkdirSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';

const binDir = join('node_modules', '.bin');
mkdirSync(binDir, { recursive: true });

const isWindows = platform() === 'win32';
const link = join(binDir, isWindows ? 'orval.cmd' : 'orval');

try {
  lstatSync(link);
  unlinkSync(link);
} catch {}

if (isWindows) {
  writeFileSync(link, '@node "%~dp0\\..\\orval\\dist\\bin\\orval.mjs" %*\r\n');
} else {
  symlinkSync('../orval/dist/bin/orval.mjs', link);
}
