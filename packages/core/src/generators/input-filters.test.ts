import { describe, expect, it } from 'vite-plus/test';

import type { NormalizedInputOptions, OpenApiDocument } from '../types';
import {
  collectReferencedComponents,
  filteredVerbs,
  filterPathsBySchemas,
} from './input-filters';

const makeSpec = (overrides: Partial<OpenApiDocument> = {}): OpenApiDocument =>
  ({
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: { schemas: {} },
    ...overrides,
  }) as OpenApiDocument;

const emptyComponents = {
  schemas: [],
  responses: [],
  parameters: [],
  requestBodies: [],
};

describe('filteredVerbs', () => {
  it('should return all verbs if filters.tags is undefined', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters = {
      tags: undefined,
    };

    expect(filteredVerbs(verbs, filters)).toEqual(Object.entries(verbs));
  });

  it('should return verbs that match the tag filter', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters: NormalizedInputOptions['filters'] = {
      tags: ['tag1'],
    };

    expect(filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });

  it('should return verbs that match the regex filter', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters: NormalizedInputOptions['filters'] = {
      tags: [/tag1/],
    };

    expect(filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });

  describe('filters.mode', () => {
    it('should return verbs that match the tag filter', () => {
      const verbs = {
        get: {
          tags: ['tag1', 'tag2'],
          responses: {},
        },
        post: {
          tags: ['tag3', 'tag4'],
          responses: {},
        },
      };

      const filters: NormalizedInputOptions['filters'] = {
        tags: ['tag1'],
        mode: 'include',
      };

      expect(filteredVerbs(verbs, filters)).toEqual(
        Object.entries({ get: verbs.get }),
      );
    });

    it('should return verbs that do not match the tag filter', () => {
      const verbs = {
        get: {
          tags: ['tag1', 'tag2'],
          responses: {},
        },
        post: {
          tags: ['tag3', 'tag4'],
          responses: {},
        },
      };

      const filters: NormalizedInputOptions['filters'] = {
        tags: ['tag1'],
        mode: 'exclude',
      };

      expect(filteredVerbs(verbs, filters)).toEqual(
        Object.entries({ post: verbs.post }),
      );
    });
  });
});

describe('collectReferencedComponents', () => {
  it('returns empty components when no operations match the tag filter', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(collectReferencedComponents(spec, ['users'], 'include')).toEqual(
      emptyComponents,
    );
  });

  it('collects direct schema $ref from a matching operation', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.schemas).toEqual(expect.arrayContaining(['Pet']));
  });

  it('collects transitive schema $ref (A -> B -> C)', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { tag: { $ref: '#/components/schemas/Tag' } },
          },
          Tag: {
            type: 'object',
            properties: {
              category: { $ref: '#/components/schemas/Category' },
            },
          },
          Category: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.schemas).toEqual(
      expect.arrayContaining(['Pet', 'Tag', 'Category']),
    );
  });

  it('collects $ref inside oneOf / allOf / anyOf arrays', () => {
    const spec = makeSpec({
      paths: {
        '/animals': {
          get: {
            tags: ['animals'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        { $ref: '#/components/schemas/Cat' },
                        { $ref: '#/components/schemas/Dog' },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Cat: { type: 'object' },
          Dog: { type: 'object' },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['animals'], 'include');
    expect(result.schemas).toEqual(expect.arrayContaining(['Cat', 'Dog']));
  });

  it('does not loop infinitely on circular $ref (A -> A)', () => {
    const spec = makeSpec({
      paths: {
        '/tree': {
          get: {
            tags: ['tree'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/TreeNode' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          TreeNode: {
            type: 'object',
            properties: {
              child: { $ref: '#/components/schemas/TreeNode' },
            },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['tree'], 'include');
    expect(result.schemas).toEqual(expect.arrayContaining(['TreeNode']));
  });

  it('matches tags using RegExp', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
        '/users': {
          get: {
            tags: ['users'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: { type: 'object' },
          User: { type: 'object' },
        },
      },
    });

    const result = collectReferencedComponents(spec, [/^pet/], 'include');
    expect(result.schemas).toEqual(expect.arrayContaining(['Pet']));
    expect(result.schemas).not.toContain('User');
  });

  it('does not collect cross-file $ref and does not crash', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: './other.yaml#/components/schemas/ExternalPet',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(collectReferencedComponents(spec, ['pets'], 'include')).toEqual(
      emptyComponents,
    );
  });

  it('excludes operations matching tags when mode is exclude', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
        '/users': {
          get: {
            tags: ['users'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: { type: 'object' },
          User: { type: 'object' },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'exclude');
    expect(result.schemas).toEqual(expect.arrayContaining(['User']));
    expect(result.schemas).not.toContain('Pet');
  });

  it('collects schemas referenced via #/components/responses/*', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              404: { $ref: '#/components/responses/NotFound' },
            },
          },
        },
      },
      components: {
        responses: {
          NotFound: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.responses).toEqual(expect.arrayContaining(['NotFound']));
    expect(result.schemas).toEqual(expect.arrayContaining(['Error']));
  });

  it('collects schemas referenced via #/components/parameters/*', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            parameters: [{ $ref: '#/components/parameters/PetFilter' }],
            responses: { 200: { description: 'OK' } },
          },
        },
      },
      components: {
        parameters: {
          PetFilter: {
            name: 'filter',
            in: 'query',
            schema: { $ref: '#/components/schemas/FilterQuery' },
          },
        },
        schemas: {
          FilterQuery: {
            type: 'object',
            properties: { status: { type: 'string' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.parameters).toEqual(expect.arrayContaining(['PetFilter']));
    expect(result.schemas).toEqual(expect.arrayContaining(['FilterQuery']));
  });

  it('collects schemas referenced via #/components/requestBodies/*', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          post: {
            tags: ['pets'],
            requestBody: { $ref: '#/components/requestBodies/CreatePet' },
            responses: { 201: { description: 'Created' } },
          },
        },
      },
      components: {
        requestBodies: {
          CreatePet: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NewPet' },
              },
            },
          },
        },
        schemas: {
          NewPet: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.requestBodies).toEqual(expect.arrayContaining(['CreatePet']));
    expect(result.schemas).toEqual(expect.arrayContaining(['NewPet']));
  });

  it('collects refs from path-level parameters', () => {
    const spec = makeSpec({
      paths: {
        '/pets/{petId}': {
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: { $ref: '#/components/schemas/PetId' },
            },
          ],
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          PetId: { type: 'string', format: 'uuid' },
          Pet: {
            type: 'object',
            properties: {
              id: { $ref: '#/components/schemas/PetId' },
              name: { type: 'string' },
            },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.schemas).toEqual(expect.arrayContaining(['Pet', 'PetId']));
  });

  it('collects transitive schemas via responses -> schemas -> schemas', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              404: { $ref: '#/components/responses/NotFound' },
            },
          },
        },
      },
      components: {
        responses: {
          NotFound: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              details: {
                type: 'array',
                items: { $ref: '#/components/schemas/ErrorDetail' },
              },
            },
          },
          ErrorDetail: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.responses).toEqual(expect.arrayContaining(['NotFound']));
    expect(result.schemas).toEqual(
      expect.arrayContaining(['Error', 'ErrorDetail']),
    );
  });

  it('collects $ref inside $defs sibling of a top-level $ref', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      $defs: {
                        dataType: {
                          $dynamicAnchor: 'dataType',
                          $ref: '#/components/schemas/Pet',
                        },
                      },
                      $ref: '#/components/schemas/SingleResponse',
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          SingleResponse: {
            type: 'object',
            properties: {
              data: { $dynamicRef: '#dataType' },
            },
            $defs: {
              dataType: { $dynamicAnchor: 'dataType', not: {} },
            },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.schemas).toEqual(
      expect.arrayContaining(['Pet', 'SingleResponse']),
    );
  });

  it('collects $ref inside $defs when response uses generic list wrapper', () => {
    const spec = makeSpec({
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      $defs: {
                        itemType: {
                          $dynamicAnchor: 'itemType',
                          $ref: '#/components/schemas/Pet',
                        },
                      },
                      $ref: '#/components/schemas/ListResponse',
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          ListResponse: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $dynamicRef: '#itemType' },
              },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
            $defs: {
              itemType: { $dynamicAnchor: 'itemType', not: {} },
            },
          },
          Pagination: {
            type: 'object',
            properties: { total: { type: 'integer' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['pets'], 'include');
    expect(result.schemas).toEqual(
      expect.arrayContaining(['Pet', 'ListResponse', 'Pagination']),
    );
  });

  it('collects $ref inside nested allOf -> $defs with $dynamicAnchor', () => {
    const spec = makeSpec({
      paths: {
        '/folders': {
          get: {
            tags: ['folders'],
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Folder' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Folder: {
            allOf: [
              {
                $defs: {
                  folderType: {
                    $dynamicAnchor: 'folderType',
                    $ref: '#/components/schemas/Folder',
                  },
                  resourceType: {
                    $dynamicAnchor: 'resourceType',
                    $ref: '#/components/schemas/Resource',
                  },
                },
                $ref: '#/components/schemas/FolderTemplate',
              },
            ],
          },
          FolderTemplate: {
            type: 'object',
            properties: {
              children: {
                type: 'array',
                items: { $dynamicRef: '#folderType' },
              },
            },
          },
          Resource: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    });

    const result = collectReferencedComponents(spec, ['folders'], 'include');
    expect(result.schemas).toEqual(
      expect.arrayContaining(['Folder', 'FolderTemplate', 'Resource']),
    );
  });
});

describe('filterPathsBySchemas', () => {
  const schemaFilterSpec = makeSpec({
    paths: {
      '/users': {
        post: {
          operationId: 'createUser',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserRequest' },
              },
            },
          },
          responses: { 200: { description: 'OK' } },
        },
      },
      '/users/{id}': {
        put: {
          operationId: 'updateUser',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateUserRequest' },
              },
            },
          },
          responses: { 200: { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        CreateUserRequest: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
        UpdateUserRequest: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
  });

  it('keeps only operations referencing the filtered schemas (#3689)', () => {
    const result = filterPathsBySchemas(
      schemaFilterSpec,
      ['CreateUserRequest'],
      'include',
    );

    expect(Object.keys(result.paths ?? {})).toEqual(['/users']);
  });

  it('keeps operations referencing any schema when mode is exclude', () => {
    const result = filterPathsBySchemas(
      schemaFilterSpec,
      ['CreateUserRequest'],
      'exclude',
    );

    expect(Object.keys(result.paths ?? {})).toEqual(['/users/{id}']);
  });

  it('keeps operations without any schema references', () => {
    const specWithBareOp = makeSpec({
      paths: {
        '/health': {
          get: {
            operationId: 'health',
            responses: { 200: { description: 'OK' } },
          },
        },
      },
    });

    const result = filterPathsBySchemas(
      specWithBareOp,
      ['Whatever'],
      'include',
    );
    expect(Object.keys(result.paths ?? {})).toEqual(['/health']);
  });

  it('matches schemas with RegExp filters', () => {
    const result = filterPathsBySchemas(
      schemaFilterSpec,
      [/^Create/],
      'include',
    );

    expect(Object.keys(result.paths ?? {})).toEqual(['/users']);
  });

  it('resolves schema references through #/components/responses/*', () => {
    const specWithResponseRef = makeSpec({
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            responses: {
              404: { $ref: '#/components/responses/NotFound' },
            },
          },
        },
        '/users': {
          get: {
            operationId: 'listUsers',
            responses: { 200: { description: 'OK' } },
          },
        },
      },
      components: {
        responses: {
          NotFound: {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    });

    const result = filterPathsBySchemas(
      specWithResponseRef,
      ['Error'],
      'include',
    );

    // /users has no schema refs at all and is therefore kept by design.
    expect(Object.keys(result.paths ?? {})).toEqual(['/pets', '/users']);
  });

  it('does not leak RegExp lastIndex between calls (g flag)', () => {
    const filter = /^Create/g;

    const first = filterPathsBySchemas(schemaFilterSpec, [filter], 'include');
    const second = filterPathsBySchemas(schemaFilterSpec, [filter], 'include');

    expect(Object.keys(first.paths ?? {})).toEqual(['/users']);
    expect(Object.keys(second.paths ?? {})).toEqual(['/users']);
  });

  it('does not leak lastIndex between operations (y flag)', () => {
    const sticky = /^Create/y;
    const mixedSpec = makeSpec({
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateUserRequest' },
                },
              },
            },
            responses: { 200: { description: 'OK' } },
          },
        },
        '/admins': {
          post: {
            operationId: 'createAdmin',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateAdminRequest' },
                },
              },
            },
            responses: { 200: { description: 'OK' } },
          },
        },
      },
      components: {
        schemas: {
          CreateUserRequest: { type: 'object' },
          CreateAdminRequest: { type: 'object' },
        },
      },
    });

    const result = filterPathsBySchemas(mixedSpec, [sticky], 'include');

    // A sticky filter advances lastIndex after /users matches; without a
    // reset, /admins would be tested from the wrong offset and rejected.
    expect(Object.keys(result.paths ?? {})).toEqual(['/users', '/admins']);
  });

  it('removes only the rejected verb when a path has mixed operations', () => {
    const mixedSpec = makeSpec({
      paths: {
        '/users': {
          get: {
            operationId: 'getUser',
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUserRequest' },
                  },
                },
              },
            },
          },
          post: {
            operationId: 'postUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UpdateUserRequest' },
                },
              },
            },
            responses: { 200: { description: 'OK' } },
          },
        },
      },
      components: {
        schemas: {
          CreateUserRequest: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          UpdateUserRequest: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    });

    const result = filterPathsBySchemas(
      mixedSpec,
      ['CreateUserRequest'],
      'include',
    );

    // The path survives with `get`, but the rejected `post` is gone.
    const pathItem = result.paths?.['/users'];
    expect(pathItem).toBeDefined();
    expect(pathItem && 'get' in pathItem).toBe(true);
    expect(pathItem && 'post' in pathItem).toBe(false);
  });

  it('preserves path-level metadata while filtering verbs', () => {
    const metadataSpec = makeSpec({
      paths: {
        '/users': {
          summary: 'Users collection',
          description: 'Operations about users',
          parameters: [
            {
              name: 'verbose',
              in: 'query',
              schema: { type: 'boolean' },
            },
          ],
          get: {
            operationId: 'getUser',
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUserRequest' },
                  },
                },
              },
            },
          },
          post: {
            operationId: 'postUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UpdateUserRequest' },
                },
              },
            },
            responses: { 200: { description: 'OK' } },
          },
        },
      },
      components: {
        schemas: {
          CreateUserRequest: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          UpdateUserRequest: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    });

    const result = filterPathsBySchemas(
      metadataSpec,
      ['CreateUserRequest'],
      'include',
    );

    const pathItem = result.paths?.['/users'] as Record<string, unknown>;
    expect(pathItem['summary']).toBe('Users collection');
    expect(pathItem['description']).toBe('Operations about users');
    expect(Array.isArray(pathItem['parameters'])).toBe(true);
    expect('post' in pathItem).toBe(false);
  });
});
