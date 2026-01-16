import { describe, expect, it } from 'vitest';

import { type GeneratorSchema, NamingConvention } from '../types';
import { fixCrossDirectoryImports, splitSchemasByType } from './schemas';

const createMockSchema = (name: string): GeneratorSchema => ({
  name,
  model: `export type ${name} = {};`,
  imports: [],
  schema: {},
});

describe('splitSchemasByType', () => {
  it('should return empty arrays for empty input', () => {
    const result = splitSchemasByType([]);
    expect(result.regularSchemas).toEqual([]);
    expect(result.operationSchemas).toEqual([]);
  });

  it('should classify *Params as operation schemas', () => {
    const schemas = [
      createMockSchema('GetUserParams'),
      createMockSchema('ListUsersParams'),
      createMockSchema('User'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'GetUserParams',
      'ListUsersParams',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['User']);
  });

  it('should classify *Body as operation schemas', () => {
    const schemas = [
      createMockSchema('CreateUserBody'),
      createMockSchema('UpdatePostBody'),
      createMockSchema('Post'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'CreateUserBody',
      'UpdatePostBody',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['Post']);
  });

  it('should classify *Parameter as operation schemas', () => {
    const schemas = [
      createMockSchema('PageParameter'),
      createMockSchema('LimitParameter'),
      createMockSchema('Pagination'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'PageParameter',
      'LimitParameter',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['Pagination']);
  });

  it('should classify *Query as operation schemas', () => {
    const schemas = [
      createMockSchema('SearchQuery'),
      createMockSchema('FilterQuery'),
      createMockSchema('QueryResult'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'SearchQuery',
      'FilterQuery',
    ]);
    // QueryResult doesn't end with Query, so it's a regular schema
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['QueryResult']);
  });

  it('should classify *Header as operation schemas', () => {
    const schemas = [
      createMockSchema('AuthHeader'),
      createMockSchema('ContentTypeHeader'),
      createMockSchema('HeaderInfo'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'AuthHeader',
      'ContentTypeHeader',
    ]);
    // HeaderInfo doesn't end with Header, so it's regular
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['HeaderInfo']);
  });

  it('should classify *Response and *Response{N} as operation schemas', () => {
    const schemas = [
      createMockSchema('GetUser200Response'),
      createMockSchema('NotFoundResponse'),
      createMockSchema('ErrorResponse'),
      createMockSchema('UserResponseDto'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'GetUser200Response',
      'NotFoundResponse',
      'ErrorResponse',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual([
      'UserResponseDto',
    ]);
  });

  it('should be case-insensitive for pattern matching', () => {
    const schemas = [
      createMockSchema('getUserPARAMS'),
      createMockSchema('createUserBODY'),
      createMockSchema('User'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'getUserPARAMS',
      'createUserBODY',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['User']);
  });

  it('should correctly separate mixed schema types', () => {
    const schemas = [
      createMockSchema('User'),
      createMockSchema('GetUserParams'),
      createMockSchema('Post'),
      createMockSchema('CreatePostBody'),
      createMockSchema('Comment'),
      createMockSchema('GetPosts200Response'),
      createMockSchema('Tag'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.regularSchemas.map((s) => s.name)).toEqual([
      'User',
      'Post',
      'Comment',
      'Tag',
    ]);
    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'GetUserParams',
      'CreatePostBody',
      'GetPosts200Response',
    ]);
  });

  it('should preserve schema properties when splitting', () => {
    const schema: GeneratorSchema = {
      name: 'GetUserParams',
      model: 'export type GetUserParams = { id: string };',
      imports: [{ name: 'SomeType', importPath: './some-type' }],
      schema: { type: 'object' },
      dependencies: ['SomeType'],
    };

    const result = splitSchemasByType([schema]);

    expect(result.operationSchemas[0]).toEqual(schema);
  });
});

describe('fixCrossDirectoryImports', () => {
  const createSchemaWithImports = (
    name: string,
    importNames: string[],
  ): GeneratorSchema => ({
    name,
    model: `export type ${name} = {};`,
    imports: importNames.map((n) => ({ name: n })),
    schema: {},
  });

  it('should fix imports from operation schemas to regular schemas', () => {
    const opSchemas = [
      createSchemaWithImports('GetUserParams', ['User', 'OtherParam']),
    ];
    const regularSchemaNames = new Set(['User']);

    fixCrossDirectoryImports(
      opSchemas,
      regularSchemaNames,
      './models',
      './models/params',
      NamingConvention.CAMEL_CASE,
    );

    expect(opSchemas[0].imports).toEqual([
      { name: 'User', importPath: '../user' },
      { name: 'OtherParam' },
    ]);
  });

  it('should handle deeper directory nesting', () => {
    const opSchemas = [createSchemaWithImports('GetUserParams', ['User'])];
    const regularSchemaNames = new Set(['User']);

    fixCrossDirectoryImports(
      opSchemas,
      regularSchemaNames,
      './src/models',
      './src/models/api/params',
      NamingConvention.CAMEL_CASE,
    );

    expect(opSchemas[0].imports[0].importPath).toBe('../../user');
  });

  it('should respect naming convention', () => {
    const opSchemas = [createSchemaWithImports('GetUserParams', ['UserInfo'])];
    const regularSchemaNames = new Set(['UserInfo']);

    fixCrossDirectoryImports(
      opSchemas,
      regularSchemaNames,
      './models',
      './models/params',
      NamingConvention.PASCAL_CASE,
    );

    expect(opSchemas[0].imports[0].importPath).toBe('../UserInfo');
  });

  it('should not modify imports that are not regular schemas', () => {
    const opSchemas = [
      createSchemaWithImports('GetUserParams', ['OtherParams', 'SomeBody']),
    ];
    const regularSchemaNames = new Set(['User']);

    fixCrossDirectoryImports(
      opSchemas,
      regularSchemaNames,
      './models',
      './models/params',
      NamingConvention.CAMEL_CASE,
    );

    expect(opSchemas[0].imports).toEqual([
      { name: 'OtherParams' },
      { name: 'SomeBody' },
    ]);
  });

  it('should handle multiple schemas with multiple imports', () => {
    const opSchemas = [
      createSchemaWithImports('GetUserParams', ['User', 'Role']),
      createSchemaWithImports('CreatePostBody', ['Post', 'Author']),
    ];
    const regularSchemaNames = new Set(['User', 'Post', 'Role']);

    fixCrossDirectoryImports(
      opSchemas,
      regularSchemaNames,
      './models',
      './models/params',
      NamingConvention.CAMEL_CASE,
    );

    expect(opSchemas[0].imports).toEqual([
      { name: 'User', importPath: '../user' },
      { name: 'Role', importPath: '../role' },
    ]);
    expect(opSchemas[1].imports).toEqual([
      { name: 'Post', importPath: '../post' },
      { name: 'Author' },
    ]);
  });
});
