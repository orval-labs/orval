import { describe, expect, it } from 'vite-plus/test';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { NamingConvention } from '../types';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { createSchemaOutputPlan } from './schema-output-plan';

describe('generateImportsForBuilder', () => {
  const createMockOutput = (
    overrides: Partial<NormalizedOutputOptions> = {},
  ): NormalizedOutputOptions =>
    ({
      namingConvention: NamingConvention.CAMEL_CASE,
      indexFiles: false,
      fileExtension: '.ts',
      ...overrides,
    }) as NormalizedOutputOptions;

  const createMockImport = (
    name: string,
    schemaName?: string,
  ): GeneratorImport => ({
    name,
    schemaName,
  });

  it('routes direct client imports through the schema output plan', () => {
    const output = createMockOutput({
      indexFiles: false,
      schemas: {
        path: './schemas',
        type: 'typescript',
        splitByTags: false,
        routes: { default: 'models', enum: 'types' },
      },
    });
    const plan = createSchemaOutputPlan({
      basePath: '/tmp/schemas',
      schemas: [
        {
          name: 'User',
          kind: 'schema',
          model: 'export type User = unknown;',
          imports: [],
        },
        {
          name: 'UserStatus',
          kind: 'enum',
          model: 'export const UserStatus = {};',
          imports: [],
        },
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    const result = generateImportsForBuilder(
      output,
      [createMockImport('User'), createMockImport('UserStatus')],
      '../schemas',
      undefined,
      plan,
    );

    expect(result).toEqual([
      { exports: [{ name: 'User' }], dependency: '../schemas/models/user' },
      {
        exports: [{ name: 'UserStatus' }],
        dependency: '../schemas/types/userStatus',
      },
    ]);
  });

  it('canonicalizes direct client imports that use a schema alias', () => {
    const output = createMockOutput({
      indexFiles: false,
      schemas: {
        path: './schemas',
        type: 'typescript',
        splitByTags: false,
        routes: { default: 'models', enum: 'types' },
      },
    });
    const plan = createSchemaOutputPlan({
      basePath: '/tmp/schemas',
      schemas: [
        {
          name: 'UserStatus',
          kind: 'enum',
          model: 'export type UserStatus = string;',
          imports: [],
          schema: { type: 'string', enum: ['active'] },
        },
        {
          name: 'user_status',
          kind: 'enum',
          model: 'export type user_status = string;',
          imports: [],
          schema: { type: 'string', enum: ['active'] },
        },
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    const result = generateImportsForBuilder(
      output,
      [createMockImport('user_status')],
      '../schemas',
      undefined,
      plan,
    );

    expect(result).toEqual([
      {
        exports: [{ name: 'UserStatus' }],
        dependency: '../schemas/types/userStatus',
      },
    ]);
  });

  it('uses the generated schema name when schemaName differs', () => {
    const output = createMockOutput({
      indexFiles: false,
      schemas: {
        path: './schemas',
        type: 'typescript',
        splitByTags: false,
        routes: { default: 'models', enum: 'types' },
        importPath: '@acme/models',
      },
    });
    const plan = createSchemaOutputPlan({
      basePath: '/tmp/schemas',
      schemas: [
        {
          name: 'UserStatus',
          kind: 'enum',
          model: 'export type UserStatus = string;',
          imports: [],
          schema: { type: 'string', enum: ['active'] },
        },
        {
          name: 'user_status',
          kind: 'enum',
          model: 'export type user_status = string;',
          imports: [],
          schema: { type: 'string', enum: ['active'] },
        },
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
      importPath: '@acme/models',
    });

    expect(
      generateImportsForBuilder(
        output,
        [createMockImport('UserStatus', 'UserStatusSchema')],
        '../schemas',
        undefined,
        plan,
      ),
    ).toEqual([
      {
        exports: [{ name: 'UserStatus', schemaName: 'UserStatusSchema' }],
        dependency: '@acme/models/types/userStatus',
      },
    ]);
  });

  it('uses the package root or routed subpath for importPath', () => {
    const schemas = [
      {
        name: 'UserStatus',
        kind: 'enum' as const,
        model: 'export type UserStatus = string;',
        imports: [],
      },
      {
        name: 'User',
        kind: 'schema' as const,
        model: 'export type User = unknown;',
        imports: [],
      },
    ];
    const plan = createSchemaOutputPlan({
      basePath: '/tmp/schemas',
      schemas,
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
      importPath: '@acme/models',
    });
    const output = createMockOutput({
      schemas: {
        path: './schemas',
        type: 'typescript',
        splitByTags: false,
        routes: { default: 'models', enum: 'types' },
        importPath: '@acme/models',
      },
    });

    expect(
      generateImportsForBuilder(
        output,
        [createMockImport('UserStatus')],
        '../schemas',
        undefined,
        plan,
      ),
    ).toEqual([
      {
        exports: [{ name: 'UserStatus' }],
        dependency: '@acme/models/types/userStatus',
      },
    ]);
    const rootPlan = createSchemaOutputPlan({
      basePath: '/tmp/schemas',
      schemas,
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: true,
      importPath: '@acme/models',
    });
    expect(
      generateImportsForBuilder(
        { ...output, indexFiles: true },
        [createMockImport('UserStatus')],
        '../schemas',
        undefined,
        rootPlan,
      ),
    ).toEqual([
      {
        exports: [{ name: 'UserStatus' }],
        dependency: '@acme/models',
      },
    ]);
  });

  describe('without indexFiles', () => {
    it('should generate imports with default .ts extension', () => {
      const output = createMockOutput({ indexFiles: false });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '../models/user',
        },
        {
          exports: [{ name: 'Pet' }],
          dependency: '../models/pet',
        },
      ]);
    });

    it('should generate imports with custom file extension (.gen.ts)', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
      });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '../models/user.gen',
        },
        {
          exports: [{ name: 'Pet' }],
          dependency: '../models/pet.gen',
        },
      ]);
    });

    it('should generate imports with custom file extension (.model.ts)', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.model.ts',
      });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '../models/user.model',
        },
        {
          exports: [{ name: 'Pet' }],
          dependency: '../models/pet.model',
        },
      ]);
    });

    it('should generate imports with non-.ts extension', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.mjs',
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '../models/user.mjs',
        },
      ]);
    });

    it('should use the TS identifier (name) for the file name, not schemaName (#2912)', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
      });
      const imports = [createMockImport('UserType', 'User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      // The schemas writer emits files named after `schema.name` (the full
      // TS identifier), so the import path must resolve to `usertype`, not
      // the bare ref name `user` (whose file is never written).
      expect(result).toEqual([
        {
          exports: [{ name: 'UserType', schemaName: 'User' }],
          dependency: '../models/userType.gen',
        },
      ]);
    });

    it('should handle zod schemas with custom extension', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
        schemas: { path: './schemas', type: 'zod', splitByTags: false },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User', schemaName: undefined }],
          dependency: '../models/user.zod.gen',
        },
      ]);
    });

    it('should use import name for zod schema file path when schemaName differs', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: { path: './schemas', type: 'zod', splitByTags: false },
      });
      const imports = [
        createMockImport('PortfolioResponseSchema', 'PortfolioResponse'),
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            {
              name: 'PortfolioResponseSchema',
              schemaName: 'PortfolioResponse',
            },
          ],
          dependency: '../models/portfolioResponseSchema.zod',
        },
      ]);
    });

    it('routes an Output type alias to its base schema zod file via zodBaseName', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: { path: './schemas', type: 'zod', splitByTags: false },
      });
      const imports: GeneratorImport[] = [
        { name: 'Pets', schemaName: 'Pets', values: true },
        { name: 'PetsOutput', zodBaseName: 'Pets' },
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            { name: 'Pets', schemaName: 'Pets', values: true },
            { name: 'PetsOutput', zodBaseName: 'Pets' },
          ],
          dependency: '../models/pets.zod',
        },
      ]);
    });
  });

  describe('with indexFiles', () => {
    it('should generate single import pointing to schemas directory', () => {
      const output = createMockOutput({
        indexFiles: true,
        fileExtension: '.ts',
      });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }, { name: 'Pet' }],
          dependency: '../models',
        },
      ]);
    });

    it('should generate zod index import with custom extension', () => {
      const output = createMockOutput({
        indexFiles: true,
        fileExtension: '.gen.ts',
        schemas: { path: './schemas', type: 'zod', splitByTags: false },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User', schemaName: undefined }],
          dependency: '../models',
        },
      ]);
    });
  });

  describe('imports with explicit importPath', () => {
    it('should group imports with the same importPath into a single dependency', () => {
      const output = createMockOutput({ indexFiles: false });
      const imports: GeneratorImport[] = [
        {
          name: 'getPetResponseMock',
          values: true,
          importPath: './pets.faker',
        },
        {
          name: 'getUserResponseMock',
          values: true,
          importPath: './pets.faker',
        },
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            {
              name: 'getPetResponseMock',
              values: true,
              importPath: './pets.faker',
            },
            {
              name: 'getUserResponseMock',
              values: true,
              importPath: './pets.faker',
            },
          ],
          dependency: './pets.faker',
        },
      ]);
    });

    it('merges a type-only and a value import of the same name into one value import', () => {
      const output = createMockOutput({ indexFiles: false });
      const imports: GeneratorImport[] = [
        { name: 'HttpHeaders', importPath: '@angular/common/http' },
        {
          name: 'HttpHeaders',
          values: true,
          importPath: '@angular/common/http',
        },
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            {
              name: 'HttpHeaders',
              values: true,
              importPath: '@angular/common/http',
            },
          ],
          dependency: '@angular/common/http',
        },
      ]);
    });

    it('should separate imports with different importPaths into different dependencies', () => {
      const output = createMockOutput({ indexFiles: false });
      const imports: GeneratorImport[] = [
        {
          name: 'getPetResponseMock',
          values: true,
          importPath: './pets.faker',
        },
        {
          name: 'getHealthResponseMock',
          values: true,
          importPath: './health.faker',
        },
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            {
              name: 'getPetResponseMock',
              values: true,
              importPath: './pets.faker',
            },
          ],
          dependency: './pets.faker',
        },
        {
          exports: [
            {
              name: 'getHealthResponseMock',
              values: true,
              importPath: './health.faker',
            },
          ],
          dependency: './health.faker',
        },
      ]);
    });

    it('should deduplicate imports with the same name and importPath', () => {
      const output = createMockOutput({ indexFiles: false });
      const imports: GeneratorImport[] = [
        {
          name: 'getPetResponseMock',
          values: true,
          importPath: './pets.faker',
        },
        {
          name: 'getPetResponseMock',
          values: true,
          importPath: './pets.faker',
        },
      ];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [
            {
              name: 'getPetResponseMock',
              values: true,
              importPath: './pets.faker',
            },
          ],
          dependency: './pets.faker',
        },
      ]);
    });
  });

  describe('with importPath (package import specifier)', () => {
    it('should use package import path with indexFiles', () => {
      const output = createMockOutput({
        indexFiles: true,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
      });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }, { name: 'Pet' }],
          dependency: '@acme/models',
        },
      ]);
    });

    it('should use package import path without file extension when indexFiles is false', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
      });
      const imports = [createMockImport('User'), createMockImport('Pet')];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '@acme/models/user',
        },
        {
          exports: [{ name: 'Pet' }],
          dependency: '@acme/models/pet',
        },
      ]);
    });

    it('should use package import path without file extension even with NodeNext tsconfig', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        tsconfig: {
          compilerOptions: {
            module: 'NodeNext' as const,
            moduleResolution: 'NodeNext' as const,
          },
        },
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User' }],
          dependency: '@acme/models/user',
        },
      ]);
    });

    it('should preserve zod suffix with package import path when indexFiles is false', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'zod',
          importPath: '@acme/models',
          splitByTags: false,
        },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User', schemaName: undefined }],
          dependency: '@acme/models/user.zod',
        },
      ]);
    });

    it('should omit file extension for schemaFactory imports with package import path', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
      });
      const imports: GeneratorImport[] = [
        { name: 'createUser', schemaFactory: true },
      ];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'createUser', schemaFactory: true }],
          dependency: '@acme/models/index.faker',
        },
      ]);
    });

    it('should use faker schemasImportPath verbatim for schemaFactory imports', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
        mock: {
          indexMockFiles: false,
          generators: [
            {
              type: 'faker',
              schemas: true,
              schemasImportPath: '@acme/models/fakers',
            },
          ],
        },
      });
      const imports: GeneratorImport[] = [
        { name: 'createUser', schemaFactory: true },
        { name: 'createPet', schemaFactory: true },
      ];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [
            { name: 'createUser', schemaFactory: true },
            { name: 'createPet', schemaFactory: true },
          ],
          dependency: '@acme/models/fakers',
        },
      ]);
    });

    it('should fall back to index.faker join when schemasImportPath is not set', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.ts',
        schemas: {
          path: '/libs/models',
          type: 'typescript',
          importPath: '@acme/models',
          splitByTags: false,
        },
        mock: {
          indexMockFiles: false,
          generators: [{ type: 'faker', schemas: true }],
        },
      });
      const imports: GeneratorImport[] = [
        { name: 'createUser', schemaFactory: true },
      ];

      const result = generateImportsForBuilder(output, imports, '@acme/models');

      expect(result).toEqual([
        {
          exports: [{ name: 'createUser', schemaFactory: true }],
          dependency: '@acme/models/index.faker',
        },
      ]);
    });
  });

  describe('naming conventions', () => {
    it('should apply PASCAL_CASE convention with custom extension', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
        namingConvention: NamingConvention.PASCAL_CASE,
      });
      const imports = [createMockImport('userProfile')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'userProfile' }],
          dependency: '../models/UserProfile.gen',
        },
      ]);
    });

    it('should apply SNAKE_CASE convention with custom extension', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.model.ts',
        namingConvention: NamingConvention.SNAKE_CASE,
      });
      const imports = [createMockImport('UserProfile')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'UserProfile' }],
          dependency: '../models/user_profile.model',
        },
      ]);
    });
  });

  describe('splitByTags routing', () => {
    // `buildSchemaTagMap` keys on `schema.name`, which is the pascal-cased
    // TS identifier produced by `getRefInfo`. The lookup here must use
    // `schemaImport.name` (same identifier), not `schemaName` (the original
    // `components.schemas` key). When they differ, routing by `schemaName`
    // silently misses the map and places the import at the schemas root
    // instead of the tag subdirectory.
    it('routes by the TS identifier (name), not schemaName, when they differ', () => {
      const output = createMockOutput({ indexFiles: false });
      // `name: 'Pet'` is the TS identifier the map is keyed by.
      // `schemaName: 'PetSchema'` is the original components.schemas key.
      // The tag dir ('pets') must come from looking up `Pet`, not `PetSchema`
      // (which would miss the map and produce no tag segment).
      // The filename must also come from `name` (the TS identifier), not
      // `schemaName` (the bare ref name), matching what the schemas writer
      // emits (#2912).
      const imports = [createMockImport('Pet', 'PetSchema')];
      const schemaTagMap = new Map<string, string>([['Pet', 'pets']]);

      const result = generateImportsForBuilder(
        output,
        imports,
        '../models',
        schemaTagMap,
      );

      expect(result).toHaveProperty('0.dependency', '../models/pets/pet');
    });

    it('inserts the tag subdir for matched schemas and leaves unmatched at root', () => {
      const output = createMockOutput({ indexFiles: false });
      // `Pet` is in the map; `Error` is not. Only `Pet` gets the tag segment.
      const imports = [createMockImport('Pet'), createMockImport('Error')];
      const schemaTagMap = new Map<string, string>([['Pet', 'pets']]);

      const result = generateImportsForBuilder(
        output,
        imports,
        '../models',
        schemaTagMap,
      );

      const deps = result.map((r) => r.dependency).sort();
      expect(deps).toEqual(['../models/error', '../models/pets/pet']);
    });

    it('routes an Output alias into the same tag subdir as its base schema', () => {
      const output = createMockOutput({
        indexFiles: false,
        schemas: { path: './schemas', type: 'zod', splitByTags: true },
      });
      const imports: GeneratorImport[] = [
        { name: 'Pets', schemaName: 'Pets', values: true },
        { name: 'PetsOutput', zodBaseName: 'Pets' },
      ];
      const schemaTagMap = new Map<string, string>([['Pets', 'pets']]);

      const result = generateImportsForBuilder(
        output,
        imports,
        '../models',
        schemaTagMap,
      );

      expect(result).toEqual([
        {
          exports: [
            { name: 'Pets', schemaName: 'Pets', values: true },
            { name: 'PetsOutput', zodBaseName: 'Pets' },
          ],
          dependency: '../models/pets/pets.zod',
        },
      ]);
    });
  });
});
