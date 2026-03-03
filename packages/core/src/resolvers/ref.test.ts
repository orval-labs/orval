import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { resolveExampleRefs, resolveRef } from './ref';

function createContext(spec: OpenApiDocument): ContextSpec {
  return {
    target: 'core-test',
    workspace: '/tmp',
    spec,
    output: {
      override: {
        components: {
          schemas: { suffix: '' },
        },
      },
    },
  } as ContextSpec;
}

describe('resolveRef', () => {
  it('supports schema generic and resolves local schema refs', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Position: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      },
    });

    const resolveSchemaRef: (
      schema: OpenApiReferenceObject,
      context: ContextSpec,
    ) => { schema: OpenApiSchemaObject; imports: unknown[] } = resolveRef;

    const result = resolveSchemaRef(
      { $ref: '#/components/schemas/Position' },
      context,
    );
    const typedSchema = result.schema;

    expect(typedSchema).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    });
    expect(result.imports[0]).toEqual({
      name: 'Position',
      schemaName: 'Position',
    });
  });

  it('preserves nullable and OpenAPI 3.1 type array hints from a direct ref', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          MaybePosition: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      },
    });

    const refWithHints = {
      $ref: '#/components/schemas/MaybePosition',
      nullable: true,
      type: ['object', 'null'],
    } as unknown as OpenApiReferenceObject;

    const { schema } = resolveRef(refWithHints, context);

    const withNullable = schema as OpenApiSchemaObject & {
      nullable?: boolean;
      type?: string[];
    };

    expect(withNullable.nullable).toBe(true);
    expect(withNullable.type).toEqual(['object', 'null']);
  });

  it('resolves nested schema refs and example refs in schema-like containers', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Position: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        examples: {
          PositionExample: {
            value: {
              id: 'p_1',
            },
          },
        },
      },
    });

    type NestedResolved = {
      schema: OpenApiSchemaObject;
      examples?: unknown[];
    };

    const carrier = {
      schema: {
        $ref: '#/components/schemas/Position',
      },
      examples: [{ $ref: '#/components/examples/PositionExample' }],
    };

    const resolved = resolveRef(
      carrier as unknown as OpenApiReferenceObject,
      context,
    ) as { schema: NestedResolved; imports: unknown[] };

    expect(resolved.schema.schema).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    });
    expect(resolved.schema.examples).toEqual([{ id: 'p_1' }]);
  });
});

describe('resolveExampleRefs', () => {
  const context = createContext({
    openapi: '3.1.0',
    components: {
      examples: {
        Primitive: {
          value: 'hello',
        },
        ObjectValue: {
          value: {
            id: 'p_1',
          },
        },
      },
    },
  });

  it('resolves example refs in arrays and records', () => {
    const list = resolveExampleRefs(
      [{ $ref: '#/components/examples/Primitive' }],
      context,
    );

    const map = resolveExampleRefs(
      {
        sample: { $ref: '#/components/examples/ObjectValue' },
      },
      context,
    );

    expect(list).toEqual(['hello']);
    expect(map).toEqual({ sample: { id: 'p_1' } });
  });
});
