import type { SchemaObject as SchemaObject30 } from 'openapi3-ts/oas30';
import type { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import { describe, expect, it } from 'vitest';

import type { ContextSpecs, GeneratorSchema } from '../types';
import { generateInterface } from './interface';

describe('generateInterface', () => {
  const context: ContextSpecs = {
    specKey: 'testSpec',
    output: {
      override: {},
    },
    target: 'typescript',
    specs: {},
  };

  it('should return const object with typeof', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
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
      },
    ];
    expect(got).toEqual(want);
  });

  it('should return type', () => {
    const schema: SchemaObject31 = {
      type: 'object',
      properties: {},
      required: ['message', 'code'],
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model: `export interface TestSchema { [key: string]: unknown }\n`,
        imports: [],
        dependencies: [],
      },
    ];
    expect(got).toEqual(want);
  });

  it('should generate index signature with propertyNames enum (OpenAPI 3.1)', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: 'foo' | 'bar']: string}\n`,
        imports: [],
        dependencies: [],
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with additional properties as boolean', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject { [key: 'key1' | 'key2' | 'key3']: unknown }\n`,
        imports: [],
        dependencies: [],
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with specific type in additionalProperties', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: 'id' | 'name']: number}\n`,
        imports: [],
        dependencies: [],
      },
    ];
    expect(got).toEqual(want);
  });

  it('should use string when propertyNames has no enum', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: string]: string}\n`,
        imports: [],
        dependencies: [],
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with properties already defined', () => {
    const schema: SchemaObject31 = {
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
      schema: schema as unknown as SchemaObject30,
      suffix: '',
    });

    expect(got).toHaveLength(1);
    expect(got[0].name).toBe('MyObject');
    expect(got[0].model).toContain('existingProp: string');
    expect(got[0].model).toContain("[key: 'allowed' | 'values']: number");
  });
});
