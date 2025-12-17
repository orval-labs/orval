import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiSchemaObject,
} from '../types';
import { generateInterface } from './interface';

describe('generateInterface', () => {
  const context: ContextSpec = {
    output: {
      override: {},
    },
    target: 'typescript',
    spec: {},
  };

  it('should return const object with typeof', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          const: 'Invalid data',
        },
        code: {
          type: 'integer',
          const: 1,
        },
        isError: {
          type: 'boolean',
          const: false,
        },
      },
      required: ['message', 'code'],
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model: `export const TestSchemaValue = {
  message: 'Invalid data',
  code: 1,
  isError: false,
} as const;
export type TestSchema = typeof TestSchemaValue;
`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should return type', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {},
      required: ['message', 'code'],
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model: `export interface TestSchema { [key: string]: unknown }\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should generate index signature with propertyNames enum (OpenAPI 3.1)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['foo', 'bar'],
      },
      additionalProperties: {
        type: 'string',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: 'foo' | 'bar']: string}\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with additional properties as boolean', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['key1', 'key2', 'key3'],
      },
      additionalProperties: true,
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject { [key: 'key1' | 'key2' | 'key3']: unknown }\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with specific type in additionalProperties', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['id', 'name'],
      },
      additionalProperties: {
        type: 'integer',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: 'id' | 'name']: number}\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should use string when propertyNames has no enum', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        pattern: '^[a-z]+$',
      },
      additionalProperties: {
        type: 'string',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: string]: string}\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with properties already defined', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        existingProp: {
          type: 'string',
        },
      },
      propertyNames: {
        type: 'string',
        enum: ['allowed', 'values'],
      },
      additionalProperties: {
        type: 'number',
      },
      required: ['existingProp'],
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });

    expect(got).toHaveLength(1);
    expect(got[0].name).toBe('MyObject');
    expect(got[0].model).toContain('existingProp: string');
    expect(got[0].model).toContain("[key: 'allowed' | 'values']: number");
  });

  it.each([
    ['anyOf', '|', 'AnyOf'],
    ['oneOf', '|', 'OneOf'],
    ['allOf', '&', 'AllOf'],
  ] as const)(
    'should generate %s primitive properties: type alias when useCombinedTypeAliases is true, inlined by default',
    (combiner, operator, combinerName) => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          field: {
            [combiner]: [{ type: 'string' }, { type: 'number' }],
          },
        },
      };

      // With useCombinedTypeAliases: true - creates named type alias
      const aliasContext: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            useCombinedTypeAliases: true,
          },
        },
      };
      const aliasResult = generateInterface({
        name: `Alias${combinerName}`,
        context: aliasContext,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(aliasResult).toHaveLength(2);
      expect(aliasResult[0].name).toBe(`Alias${combinerName}Field`);
      expect(aliasResult[0].model).toBe(
        `export type Alias${combinerName}Field = string ${operator} number;\n`,
      );
      expect(aliasResult[1].name).toBe(`Alias${combinerName}`);
      expect(aliasResult[1].model).toBe(
        `export interface Alias${combinerName} {\n  field?: Alias${combinerName}Field;\n}\n`,
      );

      // Default behavior (useCombinedTypeAliases defaults to false) - inlines the union/intersection
      const inlineResult = generateInterface({
        name: `Inline${combinerName}`,
        context,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(inlineResult).toHaveLength(1);
      expect(inlineResult[0].name).toBe(`Inline${combinerName}`);
      expect(inlineResult[0].model).toBe(
        `export interface Inline${combinerName} {\n  field?: string ${operator} number;\n}\n`,
      );
    },
  );

  it('should still create named type for property with inline objects even with default settings', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        result: {
          anyOf: [
            { type: 'object', properties: { data: { type: 'string' } } },
            { type: 'object', properties: { error: { type: 'string' } } },
          ],
        },
      },
    };

    const result = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });

    // Still creates named type because value contains '{' (inline objects)
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('MyObjectResult');
    expect(result[0].model).toBe(
      'export type MyObjectResult = {\n  data?: string;\n} | {\n  error?: string;\n};\n',
    );
    expect(result[1].name).toBe('MyObject');
    expect(result[1].model).toBe(
      'export interface MyObject {\n  result?: MyObjectResult;\n}\n',
    );
  });
});
