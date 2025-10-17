import { describe, expect, it } from 'vitest';
import type { ContextSpecs, GeneratorSchema } from '../types';
import { generateInterface } from './interface';
import type { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import type { SchemaObject as SchemaObject30 } from 'openapi3-ts/oas30';

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
      },
    ];
    expect(got).toEqual(want);
  });
});
