import { describe, expect, it } from 'vitest';
import { ContextSpecs, GeneratorSchema } from '../types';
import { generateInterface } from './interface';
import { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import { SchemaObject as SchemaObject30 } from 'openapi3-ts/oas30';

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
    const schema: SchemaObject31 = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          const: 'Invalid data'
        },
        code: {
          type: 'integer',
          const: 1
        }
      },
      required: [ 'message', 'code' ]
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as SchemaObject30,
      suffix: ''
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model:
`export const TestSchema = {
  message: 'Invalid data';
  code: 1;
} as const;
export type TestSchemaType = typeof TestSchema;
`,
        imports: []
      }
    ]
    expect(got).toEqual(want);
  });

});
