import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import type { DynamicScopeEntry, OpenApiDocument } from '../types';
import { resolveValue } from './value';

function createContext(
  spec: Partial<OpenApiDocument> = {},
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
      schema: { $ref: '#/components/schemas/Pet' },
      context,
    });

    expect(result.value).toBe('Pet');
    expect(result.imports[0]).toMatchObject({
      name: 'Pet',
      schemaName: 'Pet',
    });
    expect(result.isRef).toBe(true);
  });

  it('keeps the non-null type of a nullable component ref', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Name: { type: ['string', 'null'] },
          Box: {
            type: ['object', 'null'],
            properties: { id: { type: 'string' } },
          },
        },
      },
    });

    const name = resolveValue({
      schema: { $ref: '#/components/schemas/Name' },
      context,
    });
    expect(name.type).toBe('string');
    expect(name.value).toBe('Name | null');

    const box = resolveValue({
      schema: { $ref: '#/components/schemas/Box' },
      context,
    });
    expect(box.type).toBe('object');
    expect(box.value).toBe('Box | null');
  });

  it('does not classify a mixed type array component ref as an object', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Scalar: { type: ['string', 'number'] },
        },
      },
    });

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Scalar' },
      context,
    });

    expect(result.type).toBe('unknown');
  });

  // Regression for issue #398: a $ref like `#/paths/.../schema` (emitted by
  // JSON-Schema-Ref-Parser bundle()) resolves to an inline schema with no
  // corresponding `export type`. orval previously generated a broken
  // `import { Schema } from './model';` referencing an undeclared type.
  it('inlines a path-based ref instead of emitting a broken import', () => {
    const context = createContext({
      openapi: '3.1.0',
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
    });

    const result = resolveValue({
      schema: {
        $ref: '#/paths/~1%7Bid%7D/get/parameters/0/schema',
      },
      context,
    });

    expect(result.value).toBe('string');
    expect(result.imports).toHaveLength(0);
    expect(result.isRef).toBe(false);
  });

  // Defensive guard: a self-referential path-ref would otherwise recurse via
  // getScalar -> resolveValue forever, since the named-ref cycle tracker keys
  // off `resolvedImport.name` and not the ref string.
  it('breaks cycles on self-referential path-based refs', () => {
    const selfRef =
      '#/paths/~1self/get/responses/200/content/application~1json/schema';
    const context = createContext({
      openapi: '3.1.0',
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
    });

    expect(() =>
      resolveValue({
        schema: { $ref: selfRef },
        context,
      }),
    ).not.toThrow();
  });
});

describe('resolveValue with $dynamicRef', () => {
  it('resolves dynamic ref when scope matches', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: { $dynamicRef: '#category' },
      context,
    });

    expect(result.value).toBe('LocalizedCategory');
    expect(result.isRef).toBe(true);
    expect(result.imports).toEqual([
      { name: 'LocalizedCategory', schemaName: 'LocalizedCategory' },
    ]);
  });

  it('returns unknown for unsupported or unbound $dynamicRef values', () => {
    const spec: Partial<OpenApiDocument> = {
      openapi: '3.1.0',
      components: { schemas: {} },
    };
    const cases = [
      { dynamicRef: '#category', dynamicScope: {} },
      { dynamicRef: '#category', dynamicScope: undefined },
      { dynamicRef: 'other.json#anchor', dynamicScope: {} },
      { dynamicRef: '#', dynamicScope: {} },
    ];

    for (const { dynamicRef, dynamicScope } of cases) {
      const result = resolveValue({
        schema: { $dynamicRef: dynamicRef },
        context: createContext(spec, dynamicScope),
      });

      expect(result.value).toBe('unknown');
      expect(result.isRef).toBe(false);
    }
  });

  it('resolves pagination itemType to concrete type', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      itemType: { name: 'User', schemaName: 'User' },
    });

    const result = resolveValue({
      schema: { $dynamicRef: '#itemType' },
      context,
    });

    expect(result.value).toBe('User');
    expect(result.isRef).toBe(true);
  });

  it('ignores $dynamicRef keys in non-schema payloads while scanning refs', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Position' },
      context,
    });

    expect(result.value).toBe('Position');
    expect(result.isRef).toBe(true);
  });

  it('materializes refs when dynamic scope rebinds nested dynamic refs', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/BaseCategory',
      },
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

  it('parents guard prevents re-materialization of scope-affected ref', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
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
      },
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('BaseCategory');
  });

  it('ignores external $dynamicRef inside traversed allOf', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      node: { name: 'SomeType', schemaName: 'SomeType' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      },
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('Container');
  });

  it('materializes when $dynamicRef is inside allOf', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      },
      context,
    });

    expect(result.isRef).toBe(false);
    expect(result.value).toContain('DerivedNode');
  });

  it('materializes when $dynamicRef is inside $defs', () => {
    const spec: Partial<OpenApiDocument> = {
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
    };
    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      },
      context,
    });

    expect(result.isRef).toBe(false);
  });

  it('breaks cycle when hasScopeAffectedDynamicRef encounters the same object twice', () => {
    const sharedDynamicRef = {
      $dynamicRef: '#unknown',
    };
    const spec: Partial<OpenApiDocument> = {
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
    };

    const context = createContext(spec, {
      node: { name: 'DerivedNode', schemaName: 'DerivedNode' },
    });

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/Container',
      },
      context,
    });

    expect(result.isRef).toBe(true);
    expect(result.value).toBe('Container');
  });

  it('appends | null for anyOf with type null in resolved ref', () => {
    const spec: Partial<OpenApiDocument> = {
      openapi: '3.1.0',
      components: {
        schemas: {
          NullableItem: {
            anyOf: [{ type: 'null' }, { type: 'string' }],
          },
        },
      },
    };
    const context = createContext(spec);

    const result = resolveValue({
      schema: {
        $ref: '#/components/schemas/NullableItem',
      },
      context,
    });

    expect(result.value).toBe('NullableItem | null');
    expect(result.isRef).toBe(true);
  });

  it('emits generic alias value for a bound-alias $ref with $defs bindings', () => {
    // Exercises lines 132-146: extractBoundAliasInfo returns an alias and resolveValue
    // builds the generic type expression directly instead of falling through to resolveRef.
    // The bound-alias schema must be passed inline (with $ref + $defs on the same object),
    // as it would appear on a property/parameter — not as a component reference.
    const spec: Partial<OpenApiDocument> = {
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
              total: { type: 'integer' },
            },
          },
        },
      },
    };
    const context = createContext(spec);

    // Pass the bound-alias schema inline: $ref + $defs on the same object.
    const result = resolveValue({
      schema: {
        $defs: {
          itemType: {
            $dynamicAnchor: 'itemType',
            $ref: '#/components/schemas/User',
          },
        },
        $ref: '#/components/schemas/PaginatedTemplate',
      },
      context,
    });

    expect(result.value).toBe('PaginatedTemplate<User>');
    expect(result.isRef).toBe(true);
    expect(result.imports).toContainEqual({
      name: 'PaginatedTemplate',
      schemaName: 'PaginatedTemplate',
    });
    expect(result.imports).toContainEqual({
      name: 'User',
      schemaName: 'User',
    });
  });

  it('does not reuse cache across different dynamicScope bindings', () => {
    const spec: Partial<OpenApiDocument> = {
      openapi: '3.1.0',
      components: {
        schemas: {
          CategoryA: {
            $dynamicAnchor: 'category',
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          CategoryB: {
            $dynamicAnchor: 'category',
            type: 'object',
            properties: { label: { type: 'string' } },
          },
        },
      },
    };

    const schema = {
      type: 'object' as const,
      properties: {
        child: { $dynamicRef: '#category' },
      },
    };

    const resultA = resolveValue({
      schema,
      context: createContext(spec, {
        category: { name: 'CategoryA', schemaName: 'CategoryA' },
      }),
    });

    const resultB = resolveValue({
      schema,
      context: createContext(spec, {
        category: { name: 'CategoryB', schemaName: 'CategoryB' },
      }),
    });

    expect(resultA.value).toContain('CategoryA');
    expect(resultB.value).toContain('CategoryB');
  });
});
