import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import type {
  DynamicScopeEntry,
  OpenApiDocument,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { resolveValue } from './value';

function createContext(
  spec: OpenApiDocument,
  dynamicScope?: Partial<Record<string, DynamicScopeEntry>>,
) {
  return createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec,
    override: {},
    dynamicScope,
  });
}

describe('resolveValue', () => {
  it('emits a named import for a component schema ref', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    });

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Pet' } as OpenApiReferenceObject,
      context,
    });

    expect(result.value).toBe('Pet');
    expect(result.imports[0]).toMatchObject({
      name: 'Pet',
      schemaName: 'Pet',
    });
    expect(result.isRef).toBe(true);
  });

  it('inlines a path-based ref instead of emitting a broken import', () => {
    const context = createContext({
      openapi: '3.0.3',
      paths: {
        '/{id}': {
          get: {
            parameters: [
              {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/paths/~1%7Bid%7D/get/parameters/0/schema',
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    const result = resolveValue({
      schema: {
        $ref: '#/paths/~1%7Bid%7D/get/parameters/0/schema',
      } as OpenApiReferenceObject,
      context,
    });

    expect(result.value).toBe('string');
    expect(result.imports).toHaveLength(0);
    expect(result.isRef).toBe(false);
  });

  it('breaks cycles on self-referential path-based refs', () => {
    const selfRef =
      '#/paths/~1self/get/responses/200/content/application~1json/schema';
    const context = createContext({
      openapi: '3.0.3',
      paths: {
        '/self': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        child: { $ref: selfRef },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(() =>
      resolveValue({
        schema: { $ref: selfRef } as OpenApiReferenceObject,
        context,
      }),
    ).not.toThrow();
  });
});

describe('resolveValue with $dynamicRef', () => {
  it('resolves dynamic ref when scope matches', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          LocalizedCategory: {
            $dynamicAnchor: 'category',
            type: 'object',
            properties: { displayName: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: { $dynamicRef: '#category' } as unknown as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('LocalizedCategory');
    expect(result.isRef).toBe(true);
    expect(result.imports).toEqual([
      { name: 'LocalizedCategory', schemaName: 'LocalizedCategory' },
    ]);
  });

  it('falls back to unknown when anchor not in scope', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = createContext(spec, {});

    const result = resolveValue({
      schema: { $dynamicRef: '#category' } as unknown as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('unknown');
    expect(result.isRef).toBe(false);
  });

  it('resolves pagination itemType to concrete type', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      itemType: { name: 'User', schemaName: 'User' },
    });

    const result = resolveValue({
      schema: { $dynamicRef: '#itemType' } as unknown as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('User');
    expect(result.isRef).toBe(true);
  });

  it('does not interfere with normal $ref resolution', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Position: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Position' } as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('Position');
    expect(result.isRef).toBe(true);
  });

  it('ignores $dynamicRef keys in non-schema payloads while scanning refs', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Position: {
            type: 'object',
            example: { $dynamicRef: 'https://payload.example' },
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Position' } as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('Position');
    expect(result.isRef).toBe(true);
  });

  it('materializes refs when dynamic scope rebinds nested dynamic refs', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseCategory: {
            $dynamicAnchor: 'category',
            type: 'object',
            required: ['children'],
            properties: {
              children: {
                type: 'array',
                items: { $dynamicRef: '#category' },
              },
            },
          },
          LocalizedCategory: {
            $dynamicAnchor: 'category',
            allOf: [{ $ref: '#/components/schemas/BaseCategory' }],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/BaseCategory',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(false);
    expect(result.value).toContain('children: LocalizedCategory[]');
    expect(result.imports).toEqual([
      {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    ]);
  });

  it('handles dynamic ref with no dynamicScope context', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = createContext(spec);

    const result = resolveValue({
      schema: { $dynamicRef: '#category' } as unknown as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('unknown');
    expect(result.isRef).toBe(false);
  });

  it('returns unknown for external $dynamicRef without throwing', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = createContext(spec, {});

    const result = resolveValue({
      schema: {
        $dynamicRef: 'other.json#anchor',
      } as unknown as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('unknown');
    expect(result.isRef).toBe(false);
  });

  it('parents guard prevents re-materialization of scope-affected ref', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseCategory: {
            $dynamicAnchor: 'category',
            type: 'object',
            required: ['children'],
            properties: {
              children: {
                type: 'array',
                items: { $dynamicRef: '#category' },
              },
            },
          },
          LocalizedCategory: {
            $dynamicAnchor: 'category',
            allOf: [{ $ref: '#/components/schemas/BaseCategory' }],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });
    context.parents = ['BaseCategory'];

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/BaseCategory',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('BaseCategory');
  });

  it('ignores external $dynamicRef inside traversed allOf', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Container: {
            allOf: [
              { $dynamicRef: 'other.json#node' },
              { type: 'object', properties: { id: { type: 'string' } } },
            ],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      node: { name: 'SomeType', schemaName: 'SomeType' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('Container');
  });

  it('materializes when $dynamicRef is inside allOf', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              children: {
                type: 'array',
                items: { $dynamicRef: '#node' },
              },
            },
          },
          DerivedNode: {
            $dynamicAnchor: 'node',
            allOf: [
              { $ref: '#/components/schemas/BaseNode' },
              {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                },
              },
            ],
          },
          Container: {
            allOf: [
              { $dynamicRef: '#node' },
              { type: 'object', properties: { extra: { type: 'boolean' } } },
            ],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(false);
    expect(result.value).toContain('DerivedNode');
  });

  it('materializes when $dynamicRef is inside $defs', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseNode: {
            $dynamicAnchor: 'node',
            type: 'object',
          },
          DerivedNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: { label: { type: 'string' } },
          },
          Container: {
            $defs: {
              sub: { $dynamicRef: '#node' },
            },
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(false);
  });

  it('breaks cycle when hasScopeAffectedDynamicRef encounters the same object twice', () => {
    const sharedDynamicRef: Record<string, unknown> = {
      $dynamicRef: '#unknown',
    };
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Container: {
            type: 'object',
            properties: {
              a: sharedDynamicRef,
              b: sharedDynamicRef,
            },
          },
        },
      },
    } as OpenApiDocument;

    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('Container');
  });

  it('appends | null for anyOf with type null in resolved ref', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          NullableItem: {
            anyOf: [{ type: 'null' }, { type: 'string' }],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/NullableItem',
      } as OpenApiSchemaObject,
      context,
    });

    expect(result.value).toBe('NullableItem | null');
    expect(result.isRef).toBe(true);
  });
});
