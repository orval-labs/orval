import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import {
  buildDynamicScope,
  extractBoundAliasInfo,
  resolveExampleRefs,
  resolveRef,
  resolveDynamicRef,
} from './ref';

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

    interface NestedResolved {
      schema: OpenApiSchemaObject;
      examples?: unknown[];
    }

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

  it('resolves component refs with JSON-Pointer-encoded schema names', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          'My/Type': {
            type: 'object',
            properties: { slash: { type: 'string' } },
          },
          'My~Type': {
            type: 'object',
            properties: { tilde: { type: 'string' } },
          },
        },
      },
    });

    expect(
      resolveRef({ $ref: '#/components/schemas/My~1Type' }, context).schema,
    ).toMatchObject({
      properties: { slash: { type: 'string' } },
    });
    expect(
      resolveRef({ $ref: '#/components/schemas/My~0Type' }, context).schema,
    ).toMatchObject({
      properties: { tilde: { type: 'string' } },
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

  it('throws for nonexistent local refs', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: { schemas: {} },
    });

    expect(() =>
      resolveRef({ $ref: '#/components/schemas/NonExistent' }, context),
    ).toThrow('Oops... 🍻. Ref not found: #/components/schemas/NonExistent');
  });

  it('fully resolves through bound-alias (generic binding) refs', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          PaginatedTemplate: {
            $id: 'https://example.com/schemas/PaginatedTemplate',
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $dynamicRef: '#itemType' },
              },
            },
          },
          PaginatedUserResponse: {
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
            $ref: '#/components/schemas/PaginatedTemplate',
          },
        },
      },
    });

    const result = resolveRef(
      { $ref: '#/components/schemas/PaginatedUserResponse' },
      context,
    );

    expect(result.schema).toMatchObject({
      type: 'object',
      properties: {
        items: {
          type: 'array',
        },
      },
    });
    expect('$ref' in result.schema).toBe(false);
    expect(result.imports[0]).toEqual({
      name: 'PaginatedTemplate',
      schemaName: 'PaginatedTemplate',
    });
  });

  it('orders bound-alias type args from encoded template schema names', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          Group: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          'Paginated/Template~V1': {
            $defs: {
              first: { $dynamicAnchor: 'first', not: {} },
              second: { $dynamicAnchor: 'second', not: {} },
            },
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $dynamicRef: '#first' },
              },
            },
          },
          BoundResponse: {
            $defs: {
              second: {
                $dynamicAnchor: 'second',
                $ref: '#/components/schemas/Group',
              },
              first: {
                $dynamicAnchor: 'first',
                $ref: '#/components/schemas/User',
              },
            },
            $ref: '#/components/schemas/Paginated~1Template~0V1',
          },
        },
      },
    });

    const alias = extractBoundAliasInfo(
      context.spec.components?.schemas
        ?.BoundResponse as unknown as OpenApiSchemaObject,
      context,
    );

    expect(alias?.genericName).toBe('PaginatedTemplateV1');
    expect(alias?.typeArgs).toEqual(['User', 'Group']);
    expect(alias?.imports).toEqual([
      { name: 'User', schemaName: 'User' },
      { name: 'Group', schemaName: 'Group' },
    ]);
  });

  it('extractBoundAliasInfo skips null $defs entries without throwing', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          PaginatedTemplate: {
            $id: 'https://example.com/schemas/PaginatedTemplate',
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
            type: 'object',
            properties: {
              items: { type: 'array', items: { $dynamicRef: '#itemType' } },
            },
          },
          BoundResponse: {
            $defs: {
              // eslint-disable-next-line unicorn/no-null -- intentionally testing null $defs entry
              bad: null as unknown as Record<string, unknown>,
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
            $ref: '#/components/schemas/PaginatedTemplate',
          },
        },
      },
    });

    const alias = extractBoundAliasInfo(
      context.spec.components?.schemas
        ?.BoundResponse as unknown as OpenApiSchemaObject,
      context,
    );

    expect(alias?.genericName).toBe('PaginatedTemplate');
    expect(alias?.typeArgs).toEqual(['User']);
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

  it('returns undefined for undefined/empty examples', () => {
    expect(resolveExampleRefs(undefined, context)).toBeUndefined();
  });

  it('passes through non-ref examples in arrays', () => {
    const result = resolveExampleRefs(
      [{ summary: 'inline example', value: 42 }],
      context,
    );

    expect(result).toEqual([{ summary: 'inline example', value: 42 }]);
  });

  it('passes through non-ref examples in records', () => {
    const result = resolveExampleRefs(
      { fallback: { value: 'plain' } },
      context,
    );

    expect(result).toEqual({ fallback: { value: 'plain' } });
  });
});

describe('extractBoundAliasInfo — fallback typeArgs from bindingByAnchor', () => {
  it('uses bindingByAnchor values when template has no matching $defs anchors', () => {
    // Template schema has no $defs at all — typeArgs fallback branch (lines 262-265)
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          TemplateMissingDefs: {
            type: 'object',
            properties: { data: { type: 'string' } },
          },
          BoundResponse: {
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
            $ref: '#/components/schemas/TemplateMissingDefs',
          },
        },
      },
    });

    const alias = extractBoundAliasInfo(
      context.spec.components?.schemas
        ?.BoundResponse as unknown as OpenApiSchemaObject,
      context,
    );

    expect(alias).toBeDefined();
    expect(alias?.genericName).toBe('TemplateMissingDefs');
    expect(alias?.typeArgs).toEqual(['User']);
    expect(alias?.imports).toEqual([{ name: 'User', schemaName: 'User' }]);
  });

  it('returns bound-alias info from allOf binding element with extra schemas', () => {
    // Exercises the allOf branch where bindingElement is found inside allOf
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          PaginatedTemplate: {
            $id: 'https://example.com/schemas/PaginatedTemplate',
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
            type: 'object',
            properties: {
              items: { type: 'array', items: { $dynamicRef: '#itemType' } },
            },
          },
          ExtendedResponse: {
            allOf: [
              {
                $defs: {
                  itemType: {
                    $dynamicAnchor: 'itemType',
                    $ref: '#/components/schemas/User',
                  },
                },
                $ref: '#/components/schemas/PaginatedTemplate',
              },
              { type: 'object', properties: { meta: { type: 'string' } } },
            ],
          },
        },
      },
    });

    const alias = extractBoundAliasInfo(
      context.spec.components?.schemas
        ?.ExtendedResponse as unknown as OpenApiSchemaObject,
      context,
    );

    expect(alias).toBeDefined();
    expect(alias?.genericName).toBe('PaginatedTemplate');
    expect(alias?.typeArgs).toEqual(['User']);
    expect(alias?.extraSchemas).toHaveLength(1);
  });
});

describe('getSchema — missing $ref guard', () => {
  it('resolveRef throws when $ref is absent on the reference object', () => {
    // Exercises the getSchema throw branch (line 280)
    const context = createContext({
      openapi: '3.1.0',
      components: { schemas: {} },
    });

    // Bypass TypeScript by casting: pass an object that looks like a ref but has empty $ref
    expect(() =>
      resolveRef({ $ref: '' } as OpenApiReferenceObject, context),
    ).toThrow('Oops... 🍻. Ref not found: missing $ref');
  });
});

describe('resolveDynamicRef — catch branch', () => {
  it('returns unknown when the resolved schema ref does not exist in spec', () => {
    // Exercises the catch block (line 444): schemaName points to a non-existent schema
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        category: { name: 'NonExistent', schemaName: 'NonExistent' },
      },
    };

    const result = resolveDynamicRef('category', context);

    expect(result.resolvedTypeName).toBe('unknown');
    expect(result.schema).toEqual({});
    expect(result.imports).toEqual([]);
  });
});

describe('resolveDynamicRef — isParameter branch', () => {
  it('returns the parameter name directly without resolving a schema ref', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        itemType: {
          name: 'itemType',
          schemaName: 'itemType',
          isParameter: true,
        },
      },
    };

    const result = resolveDynamicRef('itemType', context);

    expect(result.resolvedTypeName).toBe('itemType');
    expect(result.schema).toEqual({});
    expect(result.imports).toEqual([]);
  });
});
