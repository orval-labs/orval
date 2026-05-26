/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiDocument } from '../types';
import { buildDynamicScope, resolveDynamicRef } from './ref';

function createContext(spec: OpenApiDocument) {
  return createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec,
    override: {},
  });
}

describe('buildDynamicScope', () => {
  it('builds scope from top-level $dynamicAnchor (Pattern A)', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          LocalizedCategory: {
            $dynamicAnchor: 'category',
            allOf: [
              { $ref: '#/components/schemas/BaseCategory' },
              { type: 'object' },
            ],
          },
          BaseCategory: {
            $dynamicAnchor: 'category',
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'LocalizedCategory',
      spec.components!.schemas!.LocalizedCategory,
      context,
    );

    expect(scope).toEqual({
      category: {
        name: 'LocalizedCategory',
        schemaName: 'LocalizedCategory',
      },
    });
  });

  it('builds scope from $defs $dynamicAnchor with $ref (Pattern B)', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          PaginatedTemplate: {
            type: 'object',
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
          },
          PaginatedUserResponse: {
            $ref: '#/components/schemas/PaginatedTemplate',
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'PaginatedUserResponse',
      spec.components!.schemas!.PaginatedUserResponse,
      context,
    );

    expect(scope).toEqual({
      itemType: { name: 'User', schemaName: 'User' },
    });
  });

  it('returns empty scope for schema without $dynamicAnchor', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          PlainSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'PlainSchema',
      spec.components!.schemas!.PlainSchema,
      context,
    );

    expect(scope).toEqual({});
  });

  it('combines top-level and $defs anchors', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Folder: { type: 'object' },
          WorkspaceFolder: {
            $dynamicAnchor: 'folder',
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/Folder',
              },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'WorkspaceFolder',
      spec.components!.schemas!.WorkspaceFolder,
      context,
    );

    expect(scope).toEqual({
      folder: {
        name: 'WorkspaceFolder',
        schemaName: 'WorkspaceFolder',
      },
      itemType: { name: 'Folder', schemaName: 'Folder' },
    });
  });

  it('ignores $defs entries without $dynamicAnchor', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Schema: {
            $dynamicAnchor: 'node',
            $defs: {
              helper: { type: 'string' },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Schema',
      spec.components!.schemas!.Schema,
      context,
    );

    expect(scope).toEqual({
      node: { name: 'Schema', schemaName: 'Schema' },
    });
  });

  it('creates parameter entry for $defs with $dynamicAnchor but no $ref', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Schema: {
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Schema',
      spec.components!.schemas!.Schema,
      context,
    );

    expect(scope).toEqual({
      itemType: { name: 'itemType', schemaName: 'itemType', isParameter: true },
    });
  });

  it('only binds own $dynamicAnchor, not sibling schemas', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseFolder: {
            $dynamicAnchor: 'folder',
            type: 'object',
          },
          BaseResource: {
            $dynamicAnchor: 'resource',
            oneOf: [],
          },
          WorkspaceFolder: {
            $dynamicAnchor: 'folder',
            allOf: [],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'BaseFolder',
      spec.components!.schemas!.BaseFolder,
      context,
    );

    expect(scope.folder.name).toBe('BaseFolder');
    expect(scope.resource).toBeUndefined();
  });

  it('does not bind anchors from other schemas', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          BaseFolder: {
            $dynamicAnchor: 'folder',
            type: 'object',
          },
          BaseResource: {
            $dynamicAnchor: 'resource',
            oneOf: [],
          },
          WorkspaceResource: {
            $dynamicAnchor: 'resource',
            oneOf: [],
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'BaseFolder',
      spec.components!.schemas!.BaseFolder,
      context,
    );

    expect(scope.folder.name).toBe('BaseFolder');
    expect(scope.resource).toBeUndefined();
  });

  it('does not overwrite own anchor with sibling', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          WorkspaceFolder: {
            $dynamicAnchor: 'folder',
            allOf: [],
          },
          BaseFolder: {
            $dynamicAnchor: 'folder',
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'WorkspaceFolder',
      spec.components!.schemas!.WorkspaceFolder,
      context,
    );

    expect(scope.folder.name).toBe('WorkspaceFolder');
  });

  it('does not overwrite $defs anchor with sibling', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object' },
          Schema: {
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
          },
          OtherSchema: {
            $dynamicAnchor: 'itemType',
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Schema',
      spec.components!.schemas!.Schema,
      context,
    );

    expect(scope.itemType.name).toBe('User');
  });

  it('normalizes dynamic anchor targets with generated type names', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          'base-category': {
            $dynamicAnchor: 'category',
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'base-category',
      spec.components!.schemas!['base-category'],
      context,
    );

    expect(scope.category).toEqual({
      name: 'BaseCategory',
      schemaName: 'base-category',
    });
  });

  it('escapes ~ and / in schema names for JSON Pointer refs', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          'foo~bar/baz': {
            $dynamicAnchor: 'node',
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'foo~bar/baz',
      spec.components!.schemas!['foo~bar/baz'],
      context,
    );

    expect(scope.node).toBeDefined();
    expect(scope.node.schemaName).toBe('foo~bar/baz');
  });

  it('returns empty scope for schemas without $dynamicAnchor', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Wrapper: {
            type: 'object',
            properties: {
              item: { $dynamicRef: '#item' },
            },
          },
          User: {
            $dynamicAnchor: 'item',
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Wrapper',
      spec.components!.schemas!.Wrapper,
      context,
    );

    expect(scope).toEqual({});
  });

  it('skips $defs entries with non-schema component refs', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Schema: {
            $dynamicAnchor: 'node',
            $defs: {
              resp: {
                $dynamicAnchor: 'node',
                $ref: '#/components/responses/SomeResponse',
              },
            },
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Schema',
      spec.components!.schemas!.Schema,
      context,
    );

    expect(scope.node.schemaName).toBe('Schema');
  });
});

describe('resolveDynamicRef', () => {
  it('resolves to the concrete type from dynamicScope', () => {
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
    const context = {
      ...createContext(spec),
      dynamicScope: {
        category: {
          name: 'LocalizedCategory',
          schemaName: 'LocalizedCategory',
        },
      },
    };

    const result = resolveDynamicRef('category', context);

    expect(result.resolvedTypeName).toBe('LocalizedCategory');
    expect(result.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'LocalizedCategory' }),
      ]),
    );
  });

  it('returns unknown when anchor is not in scope', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = { ...createContext(spec), dynamicScope: {} };

    const result = resolveDynamicRef('missing', context);

    expect(result.resolvedTypeName).toBe('unknown');
  });

  it('returns unknown when dynamicScope is undefined', () => {
    const spec = {
      openapi: '3.1.0',
      components: { schemas: {} },
    } as OpenApiDocument;
    const context = createContext(spec);

    const result = resolveDynamicRef('category', context);

    expect(result.resolvedTypeName).toBe('unknown');
  });

  it('resolves to User from generic pagination scope', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: { itemType: { name: 'User', schemaName: 'User' } },
    };

    const result = resolveDynamicRef('itemType', context);

    expect(result.resolvedTypeName).toBe('User');
    expect(result.schema).toBeDefined();
  });

  it('resolves normalized dynamic scope entries using original schema names', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          'base-category': {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        category: { name: 'BaseCategory', schemaName: 'base-category' },
      },
    };

    const result = resolveDynamicRef('category', context);

    expect(result.resolvedTypeName).toBe('BaseCategory');
    expect(result.imports).toContainEqual({
      name: 'BaseCategory',
      schemaName: 'base-category',
    });
    expect(result.schema).toMatchObject({
      properties: { id: { type: 'string' } },
    });
  });

  it('escapes ~ and / in schemaName when resolving dynamic ref', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          'foo~bar/baz': {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        node: { name: 'FooBarBaz', schemaName: 'foo~bar/baz' },
      },
    };

    const result = resolveDynamicRef('node', context);

    expect(result.resolvedTypeName).toBe('FooBarBaz');
    expect(result.schema).toMatchObject({
      properties: { id: { type: 'string' } },
    });
  });

  it('resolves self-referencing schema with own anchor', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Schema: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              child: { $dynamicRef: '#node' },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        node: { name: 'Schema', schemaName: 'Schema' },
      },
    };

    const result = resolveDynamicRef('node', context);

    expect(result.resolvedTypeName).toBe('Schema');
    expect(result.schema).toBeDefined();
  });

  it('merges resolved imports with pre-existing imports', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        itemType: { name: 'User', schemaName: 'User' },
      },
    };

    const result = resolveDynamicRef('itemType', context);

    expect(result.imports).toContainEqual({
      name: 'User',
      schemaName: 'User',
    });
  });
});

describe('resolveDynamicRef — $dynamicAnchor fallback', () => {
  it('falls back to $dynamicAnchor in another schema when not in scope', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            $dynamicAnchor: 'Pet',
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          Lizard: {
            type: 'object',
            properties: {
              playmates: {
                type: 'array',
                items: { $dynamicRef: '#Pet' },
              },
            },
          },
        },
      },
    } as OpenApiDocument;
    const context = { ...createContext(spec), dynamicScope: {} };

    const result = resolveDynamicRef('Pet', context);

    expect(result.resolvedTypeName).toBe('Pet');
    expect(result.schema).toMatchObject({
      properties: { name: { type: 'string' } },
    });
    expect(result.imports).toContainEqual({
      name: 'Pet',
      schemaName: 'Pet',
    });
  });

  it('still returns unknown when no schema declares the anchor anywhere', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = { ...createContext(spec), dynamicScope: {} };

    const result = resolveDynamicRef('Pet', context);

    expect(result.resolvedTypeName).toBe('unknown');
    expect(result.schema).toEqual({});
  });

  it('prefers local scope over fallback', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            $dynamicAnchor: 'Pet',
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          Cat: {
            $dynamicAnchor: 'Pet',
            type: 'object',
            properties: { meow: { type: 'boolean' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = {
      ...createContext(spec),
      dynamicScope: {
        Pet: { name: 'Cat', schemaName: 'Cat' },
      },
    };

    const result = resolveDynamicRef('Pet', context);

    expect(result.resolvedTypeName).toBe('Cat');
    expect(result.schema).toMatchObject({
      properties: { meow: { type: 'boolean' } },
    });
  });

  it('falls back when dynamicScope is undefined', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            $dynamicAnchor: 'Pet',
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const result = resolveDynamicRef('Pet', context);

    expect(result.resolvedTypeName).toBe('Pet');
  });
});

describe('null safety in $defs entries', () => {
  it('buildDynamicScope skips null $defs entries without throwing', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
          Container: {
            $defs: {
              // eslint-disable-next-line unicorn/no-null -- intentionally testing null $defs entry
              bad: null as unknown as Record<string, unknown>,
              good: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
            },
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Container',
      spec.components!.schemas!.Container,
      context,
    );

    expect(scope.itemType).toEqual({ name: 'User', schemaName: 'User' });
  });

  it('buildDynamicScope skips null $defs entries alongside parameter anchors', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Container: {
            $defs: {
              // eslint-disable-next-line unicorn/no-null -- intentionally testing null $defs entry
              bad: null as unknown as Record<string, unknown>,
              param: { $dynamicAnchor: 'node', type: 'string' },
            },
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Container',
      spec.components!.schemas!.Container,
      context,
    );

    expect(scope.node).toEqual({
      name: 'node',
      schemaName: 'node',
      isParameter: true,
    });
  });

  it('deduplicates colliding unbound anchor names in buildDynamicScope', () => {
    const spec = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Container: {
            $defs: {
              'foo-bar': { $dynamicAnchor: 'foo-bar', type: 'string' },
              foo_bar: { $dynamicAnchor: 'foo_bar', type: 'number' },
            },
            type: 'object',
          },
        },
      },
    } as OpenApiDocument;
    const context = createContext(spec);

    const scope = buildDynamicScope(
      'Container',
      spec.components!.schemas!.Container,
      context,
    );

    expect(scope['foo-bar']).toEqual({
      name: 'foo_bar',
      schemaName: 'foo_bar',
      isParameter: true,
    });
    expect(scope.foo_bar).toEqual({
      name: 'foo_bar2',
      schemaName: 'foo_bar2',
      isParameter: true,
    });
  });
});
