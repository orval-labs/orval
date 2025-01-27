import { describe, expect, it } from 'vitest';
import { ContextSpecs, GeneratorSchema } from '../types';
import { generateInterface } from './interface';
import { SchemaObject } from 'openapi3-ts/oas30';

describe('generateInterface', () => {
  const context: ContextSpecs = {
    specKey: 'testSpec',
    output: {
      override: {
        useConstForSchemaDefinition: true,
      },
    },
    target: 'typescript',
    specs: {},
  };

  it('should return an empty array if schemas are empty', () => {
    const schema: SchemaObject = {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema,
      suffix: ''
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model:
`export const TestSchema = {
  id?: string;
} as const;
export type TestSchemaType = typeof TestSchema;
`,
        imports: []
      }
    ]
    expect(got).toEqual(want);
  });

});
