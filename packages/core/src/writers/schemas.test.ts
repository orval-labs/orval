import { describe, expect, it } from 'vitest';

import { type GeneratorSchema, NamingConvention } from '../types';
import {
  fixCrossDirectoryImports,
  fixRegularSchemaImports,
  splitSchemasByType,
} from './schemas';

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

  it('should be case-insensitive for pattern matching (except Body)', () => {
    const schemas = [
      createMockSchema('getUserPARAMS'),
      createMockSchema('createUserBody'), // Body pattern is case-sensitive to avoid "Antibody"
      createMockSchema('User'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'getUserPARAMS',
      'createUserBody',
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

  it('should classify union body types (BodyOne, BodyTwo) as operation schemas', () => {
    const schemas = [
      createMockSchema('PostUserBodyOne'),
      createMockSchema('PostUserBodyTwo'),
      createMockSchema('CreateOrderBodyItem'),
      createMockSchema('UserProfile'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'PostUserBodyOne',
      'PostUserBodyTwo',
      'CreateOrderBodyItem',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['UserProfile']);
  });

  it('should classify status code types as operation schemas', () => {
    const schemas = [
      createMockSchema('200'),
      createMockSchema('404'),
      createMockSchema('500'),
      createMockSchema('User'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      '200',
      '404',
      '500',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['User']);
  });

  it('should classify union response types (200One, 200Two) as operation schemas', () => {
    const schemas = [
      createMockSchema('GetUser200One'),
      createMockSchema('GetUser200Two'),
      createMockSchema('PostOrder404Item'),
      createMockSchema('UserDto'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'GetUser200One',
      'GetUser200Two',
      'PostOrder404Item',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['UserDto']);
  });

  it('should classify HTTP verb + status code patterns as operation schemas', () => {
    const schemas = [
      createMockSchema('getApiUsers200'),
      createMockSchema('postApiOrders201'),
      createMockSchema('deleteApiItem404'),
      createMockSchema('ApiClient'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'getApiUsers200',
      'postApiOrders201',
      'deleteApiItem404',
    ]);
    expect(result.regularSchemas.map((s) => s.name)).toEqual(['ApiClient']);
  });

  it('should NOT classify PostgreSQL/Postfix domain types as operation schemas', () => {
    const schemas = [
      createMockSchema('PostgreSQLDataConnection'),
      createMockSchema('PostgreSQLConfig'),
      createMockSchema('PostfixServer'),
      createMockSchema('GetUserParams'),
    ];

    const result = splitSchemasByType(schemas);

    expect(result.regularSchemas.map((s) => s.name)).toEqual([
      'PostgreSQLDataConnection',
      'PostgreSQLConfig',
      'PostfixServer',
    ]);
    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'GetUserParams',
    ]);
  });

  it('should NOT classify words ending in "body" as operation schemas', () => {
    const schemas = [
      createMockSchema('Antibody'),
      createMockSchema('Somebody'),
      createMockSchema('AntibodyTest'),
      createMockSchema('CreateUserBody'), // This SHOULD be operation schema
      createMockSchema('BodyOne'), // This SHOULD be operation schema
    ];

    const result = splitSchemasByType(schemas);

    expect(result.regularSchemas.map((s) => s.name)).toEqual([
      'Antibody',
      'Somebody',
      'AntibodyTest',
    ]);
    expect(result.operationSchemas.map((s) => s.name)).toEqual([
      'CreateUserBody',
      'BodyOne',
    ]);
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

describe('fixRegularSchemaImports', () => {
  const createSchemaWithImports = (
    name: string,
    importNames: string[],
  ): GeneratorSchema => ({
    name,
    model: `export type ${name} = {};`,
    imports: importNames.map((n) => ({ name: n })),
    schema: {},
  });

  it('should fix imports from regular schemas to operation schemas', () => {
    const regularSchemas = [
      createSchemaWithImports('PythonExecutionWebRequest', [
        'Context',
        'PythonExecutionWebRequestParams',
      ]),
    ];
    const operationSchemaNames = new Set(['PythonExecutionWebRequestParams']);

    fixRegularSchemaImports(
      regularSchemas,
      operationSchemaNames,
      './models',
      './models/operations',
      NamingConvention.CAMEL_CASE,
    );

    expect(regularSchemas[0].imports).toEqual([
      { name: 'Context' },
      {
        name: 'PythonExecutionWebRequestParams',
        importPath: 'operations/pythonExecutionWebRequestParams',
      },
    ]);
  });

  it('should handle deeper directory nesting', () => {
    const regularSchemas = [createSchemaWithImports('User', ['GetUserParams'])];
    const operationSchemaNames = new Set(['GetUserParams']);

    fixRegularSchemaImports(
      regularSchemas,
      operationSchemaNames,
      './src/models',
      './src/models/api/params',
      NamingConvention.CAMEL_CASE,
    );

    expect(regularSchemas[0].imports[0].importPath).toBe(
      'api/params/getUserParams',
    );
  });

  it('should respect naming convention', () => {
    const regularSchemas = [createSchemaWithImports('User', ['GetUserParams'])];
    const operationSchemaNames = new Set(['GetUserParams']);

    fixRegularSchemaImports(
      regularSchemas,
      operationSchemaNames,
      './models',
      './models/operations',
      NamingConvention.PASCAL_CASE,
    );

    expect(regularSchemas[0].imports[0].importPath).toBe(
      'operations/GetUserParams',
    );
  });

  it('should not modify imports that are not operation schemas', () => {
    const regularSchemas = [
      createSchemaWithImports('User', ['Profile', 'Settings']),
    ];
    const operationSchemaNames = new Set(['GetUserParams']);

    fixRegularSchemaImports(
      regularSchemas,
      operationSchemaNames,
      './models',
      './models/operations',
      NamingConvention.CAMEL_CASE,
    );

    expect(regularSchemas[0].imports).toEqual([
      { name: 'Profile' },
      { name: 'Settings' },
    ]);
  });

  it('should handle multiple schemas with multiple imports', () => {
    const regularSchemas = [
      createSchemaWithImports('ExecutionRequest', [
        'Context',
        'ExecutionRequestParams',
      ]),
      createSchemaWithImports('BatchRequest', ['User', 'BatchRequestBody']),
    ];
    const operationSchemaNames = new Set([
      'ExecutionRequestParams',
      'BatchRequestBody',
    ]);

    fixRegularSchemaImports(
      regularSchemas,
      operationSchemaNames,
      './models',
      './models/operations',
      NamingConvention.CAMEL_CASE,
    );

    expect(regularSchemas[0].imports).toEqual([
      { name: 'Context' },
      {
        name: 'ExecutionRequestParams',
        importPath: 'operations/executionRequestParams',
      },
    ]);
    expect(regularSchemas[1].imports).toEqual([
      { name: 'User' },
      { name: 'BatchRequestBody', importPath: 'operations/batchRequestBody' },
    ]);
  });
});
