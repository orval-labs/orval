import { describe, expect, it } from 'vitest';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { NamingConvention } from '../types';
import { generateImportsForBuilder } from './generate-imports-for-builder';

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

    it('should use schemaName when provided', () => {
      const output = createMockOutput({
        indexFiles: false,
        fileExtension: '.gen.ts',
      });
      const imports = [createMockImport('UserType', 'User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'UserType', schemaName: 'User' }],
          dependency: '../models/user.gen',
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
});
