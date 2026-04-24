import { describe, expect, it } from 'vitest';

import type { NormalizedInputOptions, OpenApiDocument } from '../types';
import { collectReferencedComponents, filteredVerbs } from './input-filters';

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
});
