/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiDocument, OpenApiSchemaObject } from '../types';
import { generateSchemasDefinition } from './schema-definition';

function createContext(spec: OpenApiDocument) {
  return createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec,
    output: { namingConvention: 'camelCase' as const },
    override: {
      namingConvention: { enum: 'camelCase' as const },
      enumGenerationType: 'const' as const,
    },
  });
}

const recursiveCategoryTreeSpec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '0.1.0' },
  paths: {},
  components: {
    schemas: {
      BaseCategory: {
        $id: 'https://example.com/schemas/BaseCategory',
        $dynamicAnchor: 'category',
        type: 'object',
        required: ['id', 'children'],
        properties: {
          id: { type: 'string' },
          children: {
            type: 'array',
            items: { $dynamicRef: '#category' },
          },
        },
      },
      LocalizedCategory: {
        $id: 'https://example.com/schemas/LocalizedCategory',
        $dynamicAnchor: 'category',
        allOf: [
          { $ref: '#/components/schemas/BaseCategory' },
          {
            type: 'object',
            required: ['displayName', 'locale'],
            properties: {
              displayName: { type: 'string' },
              locale: { type: 'string' },
            },
          },
        ],
      },
    },
  },
};

const nestedWorkspaceSpec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '0.1.0' },
  paths: {},
  components: {
    schemas: {
      Document: {
        type: 'object',
        required: ['kind', 'id', 'title'],
        properties: {
          kind: { const: 'document' },
          id: { type: 'string' },
          title: { type: 'string' },
        },
      },
      BaseFolder: {
        $id: 'https://example.com/schemas/BaseFolder',
        $dynamicAnchor: 'folder',
        type: 'object',
        required: ['kind', 'id', 'name', 'children', 'shortcuts'],
        properties: {
          kind: { const: 'folder' },
          id: { type: 'string' },
          name: { type: 'string' },
          children: {
            type: 'array',
            items: {
              oneOf: [
                { $ref: '#/components/schemas/Document' },
                { $dynamicRef: '#folder' },
              ],
            },
          },
          shortcuts: {
            type: 'array',
            items: { $dynamicRef: '#resource' },
          },
        },
      },
      BaseResource: {
        $id: 'https://example.com/schemas/BaseResource',
        $dynamicAnchor: 'resource',
        oneOf: [
          { $ref: '#/components/schemas/Document' },
          { $dynamicRef: '#folder' },
        ],
      },
      WorkspaceFolder: {
        $id: 'https://example.com/schemas/WorkspaceFolder',
        $dynamicAnchor: 'folder',
        allOf: [
          { $ref: '#/components/schemas/BaseFolder' },
          {
            type: 'object',
            required: ['permissions'],
            properties: {
              permissions: {
                type: 'array',
                items: { enum: ['read', 'write', 'admin'] },
              },
            },
          },
        ],
      },
      WorkspaceResource: {
        $id: 'https://example.com/schemas/WorkspaceResource',
        $dynamicAnchor: 'resource',
        oneOf: [
          { $ref: '#/components/schemas/Document' },
          { $ref: '#/components/schemas/WorkspaceFolder' },
        ],
      },
      WorkspaceResponse: {
        type: 'object',
        required: ['root', 'related'],
        properties: {
          root: { $ref: '#/components/schemas/WorkspaceFolder' },
          related: {
            type: 'array',
            items: { $ref: '#/components/schemas/WorkspaceResource' },
          },
        },
      },
    },
  },
};

const genericSchemaBindingSpec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '0.1.0' },
  paths: {},
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      Group: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      PaginatedTemplate: {
        $id: 'https://example.com/schemas/PaginatedTemplate',
        $defs: {
          itemType: { $dynamicAnchor: 'itemType', not: {} },
        },
        type: 'object',
        required: ['items', 'total', 'page', 'pageSize'],
        properties: {
          items: {
            type: 'array',
            items: { $dynamicRef: '#itemType' },
          },
          total: { type: 'integer', minimum: 0 },
          page: { type: 'integer', minimum: 1 },
          pageSize: { type: 'integer', minimum: 1 },
        },
      },
      PaginatedUserResponse: {
        $id: 'https://example.com/schemas/PaginatedUserResponse',
        $defs: {
          itemType: {
            $dynamicAnchor: 'itemType',
            $ref: '#/components/schemas/User',
          },
        },
        $ref: '#/components/schemas/PaginatedTemplate',
      },
      PaginatedGroupResponse: {
        $id: 'https://example.com/schemas/PaginatedGroupResponse',
        $defs: {
          itemType: {
            $dynamicAnchor: 'itemType',
            $ref: '#/components/schemas/Group',
          },
        },
        $ref: '#/components/schemas/PaginatedTemplate',
      },
    },
  },
};

const nonIdentifierSchemaKeySpec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '0.1.0' },
  paths: {},
  components: {
    schemas: {
      'base-category': {
        $dynamicAnchor: 'category',
        type: 'object',
        properties: {
          children: {
            type: 'array',
            items: { $dynamicRef: '#category' },
          },
        },
      },
    },
  },
};

describe('generateSchemasDefinition with $dynamicRef', () => {
  describe('recursive category tree', () => {
    it('resolves children to BaseCategory[] (self-referential)', () => {
      const schemas = recursiveCategoryTreeSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(recursiveCategoryTreeSpec),
        '',
      );

      const baseCategory = result.find((s) => s.name === 'BaseCategory');
      expect(baseCategory).toBeDefined();
      expect(baseCategory!.model).toContain('BaseCategory[]');
      expect(baseCategory!.model).not.toContain('unknown[]');
    });

    it('generates LocalizedCategory with displayName and locale', () => {
      const schemas = recursiveCategoryTreeSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(recursiveCategoryTreeSpec),
        '',
      );

      const localizedCategory = result.find(
        (s) => s.name === 'LocalizedCategory',
      );
      expect(localizedCategory).toBeDefined();
      expect(localizedCategory!.model).not.toContain('BaseCategory &');
      expect(localizedCategory!.model).toContain(
        'children: LocalizedCategory[]',
      );
      expect(localizedCategory!.model).toContain('displayName');
      expect(localizedCategory!.model).toContain('locale');
    });
  });

  describe('nested workspace resources', () => {
    it('resolves WorkspaceFolder children with concrete folder type', () => {
      const schemas = nestedWorkspaceSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(nestedWorkspaceSpec),
        '',
      );

      const workspaceFolder = result.find((s) => s.name === 'WorkspaceFolder');
      expect(workspaceFolder).toBeDefined();
      expect(workspaceFolder!.model).toContain(
        'children: (Document | WorkspaceFolder)[]',
      );
    });

    it('resolves BaseFolder shortcuts to BaseResource via $dynamicAnchor fallback', () => {
      const schemas = nestedWorkspaceSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(nestedWorkspaceSpec),
        '',
      );

      const baseFolder = result.find((s) => s.name === 'BaseFolder');
      expect(baseFolder).toBeDefined();
      expect(baseFolder!.model).toContain('shortcuts: BaseResource[]');
    });

    it('resolves WorkspaceResource without unknown', () => {
      const schemas = nestedWorkspaceSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(nestedWorkspaceSpec),
        '',
      );

      const workspaceResource = result.find(
        (s) => s.name === 'WorkspaceResource',
      );
      expect(workspaceResource).toBeDefined();
      expect(workspaceResource!.model).toContain('Document');
      expect(workspaceResource!.model).toContain('WorkspaceFolder');
      expect(workspaceResource!.model).not.toContain('unknown');
    });
  });

  describe('generic schema binding (pagination)', () => {
    it('emits generic PaginatedTemplate with itemType parameter', () => {
      const schemas = genericSchemaBindingSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(genericSchemaBindingSpec),
        '',
      );

      const paginatedTemplate = result.find(
        (s) => s.name === 'PaginatedTemplate',
      );
      expect(paginatedTemplate).toBeDefined();
      expect(paginatedTemplate!.model).toContain(
        'interface PaginatedTemplate<itemType>',
      );
      expect(paginatedTemplate!.model).toContain('items: itemType[]');
    });

    it('emits paginated responses as type aliases to generic template', () => {
      const schemas = genericSchemaBindingSpec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(genericSchemaBindingSpec),
        '',
      );
      const cases = [
        ['PaginatedUserResponse', 'User'],
        ['PaginatedGroupResponse', 'Group'],
      ] as const;

      for (const [schemaName, typeArg] of cases) {
        const paginatedResponse = result.find((s) => s.name === schemaName);
        expect(paginatedResponse).toBeDefined();
        expect(paginatedResponse!.model).toContain(
          `type ${schemaName} = PaginatedTemplate<${typeArg}>`,
        );
      }
    });
    it('collects imports and readonly properties from allOf extra schemas', () => {
      const spec: OpenApiDocument = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '0.1.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
            AuditedEntity: {
              type: 'object',
              properties: {
                createdBy: { $ref: '#/components/schemas/User' },
              },
            },
            BaseTemplate: {
              $id: 'https://example.com/schemas/BaseTemplate',
              $defs: {
                itemType: { $dynamicAnchor: 'itemType', not: {} },
              },
              type: 'object',
              properties: {
                item: { $dynamicRef: '#itemType' },
              },
            },
            AuditedUserItem: {
              allOf: [
                {
                  $ref: '#/components/schemas/BaseTemplate',
                  $defs: {
                    itemType: {
                      $dynamicAnchor: 'itemType',
                      $ref: '#/components/schemas/User',
                    },
                  },
                },
                { $ref: '#/components/schemas/AuditedEntity' },
                {
                  type: 'object',
                  properties: {
                    auditId: { type: 'string', readOnly: true },
                  },
                },
              ],
            },
          },
        },
      };

      const schemas = spec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(spec),
        '',
      );

      const auditedUserItem = result.find((s) => s.name === 'AuditedUserItem');
      expect(auditedUserItem).toBeDefined();
      expect(auditedUserItem!.model).toContain('BaseTemplate<User>');
      expect(auditedUserItem!.model).toContain('AuditedEntity');
      expect(auditedUserItem!.model).toContain('readonly auditId?: string');

      const importNames = auditedUserItem!.imports.map((i) => i.name);
      expect(importNames).toContain('BaseTemplate');
      expect(importNames).toContain('AuditedEntity');
      expect(importNames).toContain('User');
      const userImports = auditedUserItem!.imports.filter(
        (i) => i.name === 'User',
      );
      expect(userImports).toHaveLength(1);
      expect(userImports[0].schemaName).toBe('User');
    });
  });

  it('normalizes non-identifier dynamic anchor schema names', () => {
    const schemas = nonIdentifierSchemaKeySpec.components!.schemas!;
    const result = generateSchemasDefinition(
      schemas,
      createContext(nonIdentifierSchemaKeySpec),
      '',
    );

    const baseCategory = result.find((s) => s.name === 'BaseCategory');
    expect(baseCategory).toBeDefined();
    expect(baseCategory!.model).toContain('children?: BaseCategory[]');
    expect(baseCategory!.model).not.toContain('base-category[]');
  });

  it('produces unknown for external $dynamicRef without throwing', () => {
    const externalDynamicRefSpec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          Container: {
            type: 'object',
            properties: {
              item: { $dynamicRef: 'other.json#node' },
            },
          },
        },
      },
    };

    const schemas = externalDynamicRefSpec.components!.schemas!;
    const result = generateSchemasDefinition(
      schemas,
      createContext(externalDynamicRefSpec),
      '',
    );

    const container = result.find((s) => s.name === 'Container');
    expect(container).toBeDefined();
    expect(container!.model).toContain('unknown');
  });

  it('resolves $dynamicRef to schema with matching $dynamicAnchor via fallback', () => {
    const unboundDynamicRefSpec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
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
    };

    const schemas = unboundDynamicRefSpec.components!.schemas!;
    const result = generateSchemasDefinition(
      schemas,
      createContext(unboundDynamicRefSpec),
      '',
    );

    const wrapper = result.find((s) => s.name === 'Wrapper');
    expect(wrapper).toBeDefined();
    expect(wrapper!.model).toContain('User');
    expect(wrapper!.model).not.toContain('unknown');
  });

  it('resolves $ref schema without dynamic bindings', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          Address: {
            type: 'object',
            properties: { city: { type: 'string' } },
          },
          Person: {
            type: 'object',
            properties: {
              address: { $ref: '#/components/schemas/Address' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const person = result.find((s) => s.name === 'Person');
    expect(person).toBeDefined();
    expect(person!.model).toContain('Address');
    expect(person!.model).not.toContain('unknown');
  });

  it('handles $defs with $dynamicAnchor but no $ref', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          BaseNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              child: { $dynamicRef: '#node' },
            },
          },
          Container: {
            $defs: {
              subNode: {
                $dynamicAnchor: 'node',
                type: 'string',
              },
            },
            type: 'object',
            properties: {
              value: { $dynamicRef: '#node' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const container = result.find((s) => s.name === 'Container');
    expect(container).toBeDefined();
  });

  it('resolves $dynamicRef inside schemaObjectKeys (not)', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          BaseNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              child: { $dynamicRef: '#node' },
              exclusion: {
                not: { $dynamicRef: '#node' },
              },
            },
          },
          DerivedNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const derivedNode = result.find((s) => s.name === 'DerivedNode');
    expect(derivedNode).toBeDefined();
    expect(derivedNode!.model).toContain('DerivedNode');
  });

  it('handles boolean schemas', () => {
    const cases = [
      ['Anything', true, '= any'],
      ['Nothing', false, '= never'],
    ] as const;

    for (const [schemaName, schemaValue, expected] of cases) {
      const spec: OpenApiDocument = {
        openapi: '3.1.0',
        info: { title: 'Test', version: '0.1.0' },
        paths: {},
        components: {
          schemas: {
            [schemaName]: schemaValue as unknown as OpenApiSchemaObject,
          },
        },
      };

      const schemas = spec.components!.schemas!;
      const result = generateSchemasDefinition(
        schemas,
        createContext(spec),
        '',
      );

      const entry = result.find((s) => s.name === schemaName);
      expect(entry).toBeDefined();
      expect(entry!.model).toContain(expected);
    }
  });

  it('handles $ref to same-name schema that is not an interface', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          Pet: {
            type: 'string',
            enum: ['cat', 'dog'],
          },
          pet: {
            $ref: '#/components/schemas/Pet',
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const aliased = result.find((s) => s.name === 'Pet');
    expect(aliased).toBeDefined();
    expect(aliased!.model).toContain('Pet');
  });

  it('handles schema with $defs but no $dynamicAnchor', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          Container: {
            $defs: {
              helper: { type: 'string' },
            },
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const container = result.find((s) => s.name === 'Container');
    expect(container).toBeDefined();
    expect(container!.model).toContain('name');
  });

  it('skips null values in $defs without crashing', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          Container: {
            $defs: {
              // eslint-disable-next-line unicorn/no-null -- intentionally testing null $defs entry
              nullDef: null as unknown as OpenApiSchemaObject,
              validDef: {
                $dynamicAnchor: 'item',
                type: 'object',
                properties: { id: { type: 'string' } },
              },
            },
            $dynamicAnchor: 'root',
            type: 'object',
            properties: {
              items: { $dynamicRef: '#item' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const container = result.find((s) => s.name === 'Container');
    expect(container).toBeDefined();
    expect(container!.model).toContain('item');
  });

  it('preserves unbound generic params for $ref schemas with $defs', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          BaseNode: {
            $dynamicAnchor: 'node',
            type: 'object',
            properties: {
              child: { $dynamicRef: '#node' },
            },
          },
          Container: {
            $defs: {
              nodeType: {
                $dynamicAnchor: 'node',
                type: 'string',
              },
            },
            $ref: '#/components/schemas/BaseNode',
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const container = result.find((s) => s.name === 'Container');
    expect(container).toBeDefined();
    expect(container!.model).toContain('type Container<node>');
  });

  it('produces unique generic params for colliding dynamic anchors', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          MultiParamTemplate: {
            $defs: {
              'foo-bar': { $dynamicAnchor: 'foo-bar', not: {} },
              foo_bar: { $dynamicAnchor: 'foo_bar', not: {} },
            },
            type: 'object',
            properties: {
              a: { $dynamicRef: '#foo-bar' },
              b: { $dynamicRef: '#foo_bar' },
            },
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const template = result.find((s) => s.name === 'MultiParamTemplate');
    expect(template).toBeDefined();
    expect(template!.model).toContain(
      'interface MultiParamTemplate<foo_bar, foo_bar2>',
    );
    expect(template!.model).toContain('a?: foo_bar');
    expect(template!.model).toContain('b?: foo_bar2');
  });

  it('passes unbound params through partially bound aliases', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          PairTemplate: {
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
              cursorType: { $dynamicAnchor: 'cursorType', not: {} },
            },
            type: 'object',
            properties: {
              item: { $dynamicRef: '#itemType' },
              cursor: { $dynamicRef: '#cursorType' },
            },
          },
          PartiallyBoundPair: {
            $defs: {
              itemType: {
                $dynamicAnchor: 'itemType',
                $ref: '#/components/schemas/User',
              },
              cursorType: { $dynamicAnchor: 'cursorType', type: 'string' },
            },
            $ref: '#/components/schemas/PairTemplate',
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const partiallyBound = result.find((s) => s.name === 'PartiallyBoundPair');
    expect(partiallyBound).toBeDefined();
    expect(partiallyBound!.model).toContain(
      'type PartiallyBoundPair<cursorType> = PairTemplate<User, cursorType>',
    );
  });

  it('resolves colliding unbound anchors via $dynamicRef in buildDynamicScope', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          DualSlotTemplate: {
            $defs: {
              'foo-bar': { $dynamicAnchor: 'foo-bar', not: {} },
              foo_bar: { $dynamicAnchor: 'foo_bar', not: {} },
            },
            type: 'object',
            properties: {
              a: { $dynamicRef: '#foo-bar' },
              b: { $dynamicRef: '#foo_bar' },
            },
          },
          BoundDualSlot: {
            $defs: {
              'foo-bar': {
                $dynamicAnchor: 'foo-bar',
                $ref: '#/components/schemas/User',
              },
              foo_bar: {
                $dynamicAnchor: 'foo_bar',
                $ref: '#/components/schemas/Group',
              },
            },
            $ref: '#/components/schemas/DualSlotTemplate',
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const template = result.find((s) => s.name === 'DualSlotTemplate');
    expect(template).toBeDefined();
    expect(template!.model).toContain(
      'interface DualSlotTemplate<foo_bar, foo_bar2>',
    );
    expect(template!.model).toContain('a?: foo_bar');
    expect(template!.model).toContain('b?: foo_bar2');

    const bound = result.find((s) => s.name === 'BoundDualSlot');
    expect(bound).toBeDefined();
    expect(bound!.model).toContain(
      'type BoundDualSlot = DualSlotTemplate<User, Group>',
    );
  });

  it('handles partially bound alias with colliding template anchors', () => {
    const spec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '0.1.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          CollidingSlotTemplate: {
            $defs: {
              'foo-bar': { $dynamicAnchor: 'foo-bar', not: {} },
              foo_bar: { $dynamicAnchor: 'foo_bar', not: {} },
            },
            type: 'object',
            properties: {
              a: { $dynamicRef: '#foo-bar' },
              b: { $dynamicRef: '#foo_bar' },
            },
          },
          PartiallyBoundColliding: {
            $defs: {
              'foo-bar': {
                $dynamicAnchor: 'foo-bar',
                $ref: '#/components/schemas/User',
              },
              foo_bar: { $dynamicAnchor: 'foo_bar', type: 'string' },
            },
            $ref: '#/components/schemas/CollidingSlotTemplate',
          },
        },
      },
    };

    const schemas = spec.components!.schemas!;
    const result = generateSchemasDefinition(schemas, createContext(spec), '');

    const template = result.find((s) => s.name === 'CollidingSlotTemplate');
    expect(template).toBeDefined();
    expect(template!.model).toContain(
      'interface CollidingSlotTemplate<foo_bar, foo_bar2>',
    );

    const partiallyBound = result.find(
      (s) => s.name === 'PartiallyBoundColliding',
    );
    expect(partiallyBound).toBeDefined();
    expect(partiallyBound!.model).toContain(
      'type PartiallyBoundColliding<foo_bar2> = CollidingSlotTemplate<User, foo_bar2>',
    );
  });
});
