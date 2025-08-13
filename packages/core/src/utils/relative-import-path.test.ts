import { describe, expect, it } from 'vitest';
import { getRelativeImportPath } from './relative-import-path';
import path from 'node:path';
import os from 'node:os';

function genPaths(a: string, b: string) {
  if (os.type() === 'win32') {
    // posix paths works on windows, but not the other way around
    return [
      ['posix', path.posix.normalize('/' + a), path.posix.normalize('/' + b)],
      [
        'windows',
        path.win32.normalize('C:\\' + a),
        path.win32.normalize('C:\\' + b),
      ],
    ];
  }

  return [
    ['posix', path.posix.normalize('/' + a), path.posix.normalize('/' + b)],
  ];
}

describe('import path testing', () => {
  it.each(genPaths('foo/bar/baz/importer.ts', 'foo/bar/exporter.ts'))(
    'should handle %s import from parent dir',
    (_, importer, exporter) => {
      expect(getRelativeImportPath(importer, exporter)).toBe('../exporter');
    },
  );

  it.each(genPaths('foo/bar/baz/importer.ts', 'foo/bar/baz/exporter.ts'))(
    'should handle %s import from same dir',
    (_, importer, exporter) => {
      expect(getRelativeImportPath(importer, exporter)).toBe('./exporter');
    },
  );

  it.each(genPaths('foo/bar/importer.ts', 'foo/bar/.ts/exporter.ts'))(
    'should handle %s import with dir matching file extension',
    (_, importer, exporter) => {
      expect(getRelativeImportPath(importer, exporter)).toBe('./.ts/exporter');
    },
  );
});
