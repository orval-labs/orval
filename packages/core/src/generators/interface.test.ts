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
    'should generate %s primitive properties: named type when inlineCombinedTypes is false, inlined when true',
    (combiner, operator, combinerName) => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          field: {
            [combiner]: [{ type: 'string' }, { type: 'number' }],
          },
        },
      };

      // Default behavior (inlineCombinedTypes: false) - creates named type
      const defaultResult = generateInterface({
        name: `Default${combinerName}`,
        context,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(defaultResult).toHaveLength(2);
      expect(defaultResult[0].name).toBe(`Default${combinerName}Field`);
      expect(defaultResult[0].model).toBe(
        `export type Default${combinerName}Field = string ${operator} number;\n`,
      );
      expect(defaultResult[1].name).toBe(`Default${combinerName}`);
      expect(defaultResult[1].model).toBe(
        `export interface Default${combinerName} {\n  field?: Default${combinerName}Field;\n}\n`,
      );

      // With inlineCombinedTypes: true - inlines the union/intersection
      const inlineContext: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: { ...context.output.override, inlineCombinedTypes: true },
        },
      };
      const inlineResult = generateInterface({
        name: `Inline${combinerName}`,
        context: inlineContext,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(inlineResult).toHaveLength(1);
      expect(inlineResult[0].name).toBe(`Inline${combinerName}`);
      expect(inlineResult[0].model).toBe(
        `export interface Inline${combinerName} {\n  field?: string ${operator} number;\n}\n`,
      );
    },
  );
});
