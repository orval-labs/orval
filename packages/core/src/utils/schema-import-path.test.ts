import { describe, expect, it } from 'vitest';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { resolveSchemaImportDependencies } from './schema-import-path';

/**
 * Schema-import resolution matrix.
 *
 * This same matrix is asserted against Angular's rendered `*.resource.ts`
 * output in `packages/angular/src/http-resource.test.ts`. Both sides call
 * `resolveSchemaImportDependencies`, so the pair pins that resource files
 * resolve schemas exactly as the mode writers do. Keep the two in step.
 */
const createOutput = (
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions =>
  ({
    target: '/tmp/pets.ts',
    namingConvention: 'camelCase',
    fileExtension: '.ts',
    indexFiles: true,
    schemas: {
      path: '/models',
      type: 'typescript',
      splitByTags: false,
    },
    ...overrides,
  }) as unknown as NormalizedOutputOptions;

const createSchemas = (
  overrides: Partial<{
    path: string;
    type: 'typescript' | 'zod';
    importPath?: string;
    splitByTags: boolean;
  }> = {},
): NormalizedOutputOptions['schemas'] =>
  ({
    path: '/models',
    type: 'typescript',
    splitByTags: false,
    ...overrides,
  }) as NormalizedOutputOptions['schemas'];

const PET: GeneratorImport = { name: 'Pet', schemaName: 'pet_original' };
const ERROR: GeneratorImport = { name: 'Error' };

const resolve = (
  output: NormalizedOutputOptions,
  base: string,
  imports: GeneratorImport[] = [PET, ERROR],
  options: { isZod?: boolean; schemaTagMap?: Map<string, string> } = {},
) =>
  resolveSchemaImportDependencies(output, base, imports, {
    isZod: options.isZod ?? false,
    schemaTagMap: options.schemaTagMap,
  }).map((dependency) => dependency.dependency);

const TAG_MAP = new Map([
  ['Pet', 'pets'],
  // `'.'` is the shared sentinel: referenced by 0 or 2+ tags, stays at root.
  ['Error', '.'],
]);

describe('resolveSchemaImportDependencies', () => {
  describe('indexFiles: true', () => {
    it('routes every import through the root barrel', () => {
      const output = createOutput({ indexFiles: true });

      expect(resolve(output, '../models')).toEqual(['../models']);
    });

    it('returns a package specifier verbatim', () => {
      const output = createOutput({
        indexFiles: true,
        schemas: createSchemas({ importPath: '@acme/models' }),
      });

      expect(resolve(output, '@acme/models')).toEqual(['@acme/models']);
    });

    it('returns the barrel verbatim even when schemas are split by tag', () => {
      // `splitByTags` still emits a root index re-exporting each tag dir, so
      // the barrel covers everything and needs no tag segment.
      const output = createOutput({
        indexFiles: true,
        schemas: createSchemas({
          importPath: '@acme/models',
          splitByTags: true,
        }),
      });

      expect(
        resolve(output, '@acme/models', [PET, ERROR], {
          schemaTagMap: TAG_MAP,
        }),
      ).toEqual(['@acme/models']);
    });
  });

  describe('indexFiles: false', () => {
    it('resolves each import to its own file under a relative path', () => {
      const output = createOutput({ indexFiles: false });

      expect(resolve(output, '../models')).toEqual([
        '../models/petOriginal',
        '../models/error',
      ]);
    });

    it('appends no file extension to package sub-paths', () => {
      // A package specifier resolves through the consumer's module
      // resolution, so `@acme/models/pet.js` would not resolve.
      const output = createOutput({
        indexFiles: false,
        fileExtension: '.ts',
        tsconfig: {
          baseUrl: '/',
          compilerOptions: { module: 'NodeNext' },
        },
        schemas: createSchemas({ importPath: '@acme/models' }),
      } as Partial<NormalizedOutputOptions>);

      expect(resolve(output, '@acme/models')).toEqual([
        '@acme/models/petOriginal',
        '@acme/models/error',
      ]);
    });

    it('appends the local file extension when the path is not a package', () => {
      const output = createOutput({
        indexFiles: false,
        fileExtension: '.ts',
        tsconfig: {
          baseUrl: '/',
          compilerOptions: { module: 'NodeNext' },
        },
      } as Partial<NormalizedOutputOptions>);

      expect(resolve(output, '../models')).toEqual([
        '../models/petOriginal.js',
        '../models/error.js',
      ]);
    });

    it('inserts the tag subdirectory for tag-scoped schemas', () => {
      const output = createOutput({
        indexFiles: false,
        schemas: createSchemas({
          importPath: '@acme/models',
          splitByTags: true,
        }),
      });

      expect(
        resolve(output, '@acme/models', [PET, ERROR], {
          schemaTagMap: TAG_MAP,
        }),
      ).toEqual(['@acme/models/pets/petOriginal', '@acme/models/error']);
    });

    it('names zod files from the TS identifier, not the schema name', () => {
      // Zod schema files are written as `conventionName(schema.name)`, so
      // resolving from `schemaName` would point at a file that is not emitted.
      const output = createOutput({
        indexFiles: false,
        schemas: createSchemas({ importPath: '@acme/models', type: 'zod' }),
      });

      expect(resolve(output, '@acme/models', [PET], { isZod: true })).toEqual([
        '@acme/models/pet.zod',
      ]);
    });

    it('keeps both imports when the same name is aliased differently', () => {
      const output = createOutput({ indexFiles: false });

      const [dependency] = resolveSchemaImportDependencies(
        output,
        '../models',
        [
          { name: 'Pet', alias: 'PetModel' },
          { name: 'Pet', alias: 'PetDto' },
        ],
        { isZod: false },
      );

      expect(dependency.exports.map((entry) => entry.alias)).toEqual([
        'PetModel',
        'PetDto',
      ]);
    });

    it('collapses imports that would emit an identical specifier', () => {
      const output = createOutput({ indexFiles: false });

      const [dependency] = resolveSchemaImportDependencies(
        output,
        '../models',
        [{ name: 'Pet' }, { name: 'Pet' }],
        { isZod: false },
      );

      expect(dependency.exports).toHaveLength(1);
    });
  });
});
