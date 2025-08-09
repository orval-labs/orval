import { describe, expect, it } from 'vitest';
import { getRelativeImportPath } from './relative-import-path';
import path from 'node:path';

function genPaths(a: string, b: string) {
  return [
    ['posix', path.posix.normalize(a), path.posix.normalize(b)],
    ['posix', path.posix.normalize('./' + a), path.posix.normalize('./' + b)],
    ['posix', path.posix.normalize('/' + a), path.posix.normalize('/' + b)],

    ['windows', path.win32.normalize(a), path.win32.normalize(b)],
    ['windows', path.win32.normalize('./' + a), path.win32.normalize('./' + b)],
    [
      'windows',
      path.win32.normalize('C:\\' + a),
      path.win32.normalize('C:\\' + b),
    ],
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
