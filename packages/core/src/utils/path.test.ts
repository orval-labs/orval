import path from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { getRelativeImportPath, getSchemaFileName } from './path';

// Build absolute paths that are valid on both Windows and Linux.
// path.parse(process.cwd()).root gives 'C:\' on Windows and '/' on Linux.
const root = path.parse(process.cwd()).root;
function abs(...parts: string[]): string {
  return path.join(root, ...parts);
}

describe('getRelativeImportPath', () => {
  describe('same directory', () => {
    it('returns a same-directory relative path without extension by default', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'api', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe('./exporter');
    });

    it('includes the extension when includeFileExtension is true', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'api', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter, true)).toBe(
        './exporter.ts',
      );
    });

    it('works for .js extension', () => {
      const importer = abs('src', 'api', 'importer.js');
      const exporter = abs('src', 'api', 'exporter.js');
      expect(getRelativeImportPath(importer, exporter, true)).toBe(
        './exporter.js',
      );
    });
  });

  describe('child directory', () => {
    it('returns a path into a subdirectory', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'api', 'sub', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe('./sub/exporter');
    });

    it('returns a path into a deeply nested subdirectory', () => {
      const importer = abs('src', 'importer.ts');
      const exporter = abs('src', 'a', 'b', 'c', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe(
        './a/b/c/exporter',
      );
    });
  });

  describe('parent / sibling directories', () => {
    it('returns a path to a sibling directory', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'sibling', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe(
        '../sibling/exporter',
      );
    });

    it('returns a path to a parent directory', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe('../exporter');
    });

    it('returns a path several levels up', () => {
      const importer = abs('src', 'a', 'b', 'c', 'importer.ts');
      const exporter = abs('lib', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toBe(
        '../../../../lib/exporter',
      );
    });
  });

  describe('path format', () => {
    it('always uses forward slashes regardless of OS', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'other', 'exporter.ts');
      const result = getRelativeImportPath(importer, exporter);
      expect(result).not.toContain('\\');
    });

    it('always starts with ./ for same-directory imports', () => {
      const importer = abs('src', 'importer.ts');
      const exporter = abs('src', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toMatch(/^\.\//);
    });

    it('starts with ../ for parent-directory imports', () => {
      const importer = abs('src', 'api', 'importer.ts');
      const exporter = abs('src', 'exporter.ts');
      expect(getRelativeImportPath(importer, exporter)).toMatch(/^\.\.\//);
    });
  });

  describe('includeFileExtension', () => {
    it('strips the extension by default', () => {
      const importer = abs('src', 'importer.ts');
      const exporter = abs('src', 'models', 'user.ts');
      const result = getRelativeImportPath(importer, exporter);
      expect(result).toBe('./models/user');
      expect(result).not.toContain('.ts');
    });

    it('preserves the extension when flag is true', () => {
      const importer = abs('src', 'importer.ts');
      const exporter = abs('src', 'models', 'user.ts');
      expect(getRelativeImportPath(importer, exporter, true)).toBe(
        './models/user.ts',
      );
    });

    it('works for files without an extension', () => {
      const importer = abs('src', 'importer.ts');
      const exporter = abs('src', 'Makefile');
      expect(getRelativeImportPath(importer, exporter)).toBe('./Makefile');
      expect(getRelativeImportPath(importer, exporter, true)).toBe(
        './Makefile',
      );
    });
  });

  describe('error handling', () => {
    it('throws when importerFilePath is not absolute', () => {
      expect(() =>
        getRelativeImportPath(
          'relative/importer.ts',
          abs('src', 'exporter.ts'),
        ),
      ).toThrow(/'importerFilePath' is not an absolute path/);
    });

    it('throws when exporterFilePath is not absolute', () => {
      expect(() =>
        getRelativeImportPath(
          abs('src', 'importer.ts'),
          'relative/exporter.ts',
        ),
      ).toThrow(/'exporterFilePath' is not an absolute path/);
    });

    it('includes the offending path in the error message', () => {
      expect(() =>
        getRelativeImportPath('bad/path.ts', abs('src', 'exporter.ts')),
      ).toThrow('"bad/path.ts"');
    });
  });
});

describe('getSchemaFileName', () => {
  it('drops the extension from the file name', () => {
    expect(getSchemaFileName('petstore.yaml')).toBe('petstore');
    expect(getSchemaFileName('specs/petstore.yaml')).toBe('petstore');
    expect(getSchemaFileName('./petstore.json')).toBe('petstore');
  });

  it('keeps a file name that has no extension', () => {
    expect(getSchemaFileName('specs/no-ext')).toBe('no-ext');
  });

  it('ignores an extension that appears in a directory name', () => {
    expect(getSchemaFileName('v1.yaml/petstore.yaml')).toBe('petstore');
    expect(getSchemaFileName('a.json/b/c.json')).toBe('c');
    expect(getSchemaFileName('v1.yaml/petstore.json')).toBe('petstore');
  });
});
