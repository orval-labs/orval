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

  it('applies schema suffix to import name when suffix is configured', () => {
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
    // Override suffix
    (
      context.output.override.components as { schemas: { suffix: string } }
    ).schemas.suffix = 'Schema';

    const result = resolveRef(
      { $ref: '#/components/schemas/Position' },
      context,
    );

    expect(result.imports[0]).toEqual({
      name: 'PositionSchema',
      schemaName: 'Position',
    });
  });

  it('returns a non-ref schema as-is when it is already dereferenced', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: { schemas: {} },
    });

    // A plain schema object (no $ref) is treated as already dereferenced
    const result = resolveRef(
      { type: 'object' } as unknown as OpenApiReferenceObject,
      context,
    );

    expect(result.schema).toMatchObject({ type: 'object' });
    expect(result.imports).toEqual([]);
  });

  it('resolves a nonexistent local ref path to the root spec (fallback behavior)', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: { schemas: {} },
    });

    // When a ref path doesn't resolve to a nested schema,
    // getSchema falls back to context.spec — the result wraps the full spec
    const result = resolveRef(
      { $ref: '#/components/schemas/NonExistent' },
      context,
    );

    // It resolves (doesn't throw) but the schema is the root spec document
    expect(result.schema).toHaveProperty('openapi', '3.1.0');
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
