import { describe, expect, it } from 'vite-plus/test';

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
    // `normalizeOptions` sets `schemaFileExtension` to `.zod.ts` for a zod
    // output, or to the user's `fileExtension` when they set one.
    schemaFileExtension: '.zod.ts',
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
  resolveSchemaImportDependencies(output, imports, base, {
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
    // The schemas writer names each file after the TS identifier, including
    // any Response/Body/Parameter suffix, so resolving from `schemaName` (the
    // bare ref) would import a file that is never written (#2912).
    it('resolves each import to its own file under a relative path', () => {
      const output = createOutput({ indexFiles: false });

      expect(resolve(output, '../models')).toEqual([
        '../models/pet',
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
        '@acme/models/pet',
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
        '../models/pet.js',
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
      ).toEqual(['@acme/models/pets/pet', '@acme/models/error']);
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

    it('names zod files from schemaFileExtension, not a hardcoded .zod', () => {
      // A user-set `fileExtension` also becomes `schemaFileExtension`, so the
      // zod writer emits `pet.gen.ts`. A hardcoded `.zod` would resolve to
      // `pet.zod.gen`, a file that is never written.
      const output = createOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
        schemaFileExtension: '.gen.ts',
        schemas: createSchemas({ type: 'zod' }),
      });

      expect(resolve(output, '../models', [PET], { isZod: true })).toEqual([
        '../models/pet.gen',
      ]);
    });

    it('keeps a custom fileExtension in a package subpath', () => {
      // The TypeScript writer emits `pet.gen.ts`, so the subpath must carry
      // `.gen`. Dropping the whole suffix would name `@acme/models/pet`, which
      // no export map resolves.
      const output = createOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
        schemas: createSchemas({ importPath: '@acme/models' }),
      });

      expect(resolve(output, '@acme/models', [PET])).toEqual([
        '@acme/models/pet.gen',
      ]);
    });

    it('keeps both imports when the same name is aliased differently', () => {
      const output = createOutput({ indexFiles: false });

      const [dependency] = resolveSchemaImportDependencies(
        output,
        [
          { name: 'Pet', alias: 'PetModel' },
          { name: 'Pet', alias: 'PetDto' },
        ],
        '../models',
        { isZod: false },
      );

      expect(dependency.exports.map((entry) => entry.alias)).toEqual([
        'PetModel',
        'PetDto',
      ]);
    });

    it('merges a type-only and a value import of one binding', () => {
      // `generateImports` groups by `values`, so keeping both would emit
      // `import type { Pet }` and `import { Pet }` from the same module —
      // TS2300. A value import serves the type position too, so it wins.
      const output = createOutput({ indexFiles: false });

      const [dependency] = resolveSchemaImportDependencies(
        output,
        [
          { name: 'Pet', values: false },
          { name: 'Pet', values: true },
        ],
        '../models',
        { isZod: false },
      );

      expect(dependency.exports).toHaveLength(1);
      expect(dependency.exports[0].values).toBe(true);
    });

    it('collapses imports that would emit an identical specifier', () => {
      const output = createOutput({ indexFiles: false });

      const [dependency] = resolveSchemaImportDependencies(
        output,
        [{ name: 'Pet' }, { name: 'Pet' }],
        '../models',
        { isZod: false },
      );

      expect(dependency.exports).toHaveLength(1);
    });
  });
});
