import { describe, expect, it } from 'vitest';

import type { NormalizedInputOptions, OpenApiDocument } from '../types';
import { collectReferencedSchemas, filteredVerbs } from './input-filters';

const makeSpec = (overrides: Partial<OpenApiDocument> = {}): OpenApiDocument =>
  ({
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: { schemas: {} },
    ...overrides,
  }) as OpenApiDocument;

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

describe('collectReferencedSchemas', () => {
  it('returns empty array when no operations match the tag filter', () => {
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

    expect(collectReferencedSchemas(spec, ['users'])).toEqual([]);
  });

  it('collects direct $ref from a matching operation', () => {
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

    expect(collectReferencedSchemas(spec, ['pets'])).toEqual(
      expect.arrayContaining(['Pet']),
    );
  });

  it('collects transitive $ref (A → B → C)', () => {
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

    expect(collectReferencedSchemas(spec, ['pets'])).toEqual(
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

    expect(collectReferencedSchemas(spec, ['animals'])).toEqual(
      expect.arrayContaining(['Cat', 'Dog']),
    );
  });

  it('does not loop infinitely on circular $ref (A → A)', () => {
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

    expect(collectReferencedSchemas(spec, ['tree'])).toEqual(
      expect.arrayContaining(['TreeNode']),
    );
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

    expect(collectReferencedSchemas(spec, [/^pet/])).toEqual(
      expect.arrayContaining(['Pet']),
    );
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

    expect(collectReferencedSchemas(spec, ['pets'])).toEqual([]);
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

    expect(collectReferencedSchemas(spec, ['pets'], 'exclude')).toEqual(
      expect.arrayContaining(['User']),
    );
  });
});
