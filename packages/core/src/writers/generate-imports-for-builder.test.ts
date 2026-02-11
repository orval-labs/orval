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
        schemas: { path: './schemas', type: 'zod' },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User', schemaName: undefined, values: true }],
          dependency: '../models/user.zod.gen',
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
        schemas: { path: './schemas', type: 'zod' },
      });
      const imports = [createMockImport('User')];

      const result = generateImportsForBuilder(output, imports, '../models');

      expect(result).toEqual([
        {
          exports: [{ name: 'User', schemaName: undefined, values: true }],
          dependency: '../models/index.zod',
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
