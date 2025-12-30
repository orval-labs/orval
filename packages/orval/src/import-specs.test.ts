import { describe, expect, it } from 'vitest';

import { dereferenceExternalRef } from './import-specs';

describe('dereferenceExternalRefs', () => {
  it('should dereference x-ext references and remove x-ext property', () => {
    const input = {
      openapi: '3.0.0',
      info: {
        title: 'Sample API',
        version: '0.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      paths: {
        '/points': {
          get: {
            operationId: 'get-points',
            responses: {
              '200': {
                description: 'A JSON array of GeoJSON points',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        $ref: '#/x-ext/d4e2d5e',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        d4e2d5e: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          $id: 'https://geojson.org/schema/Point.json',
          title: 'GeoJSON Point',
          type: 'object',
          required: ['type', 'coordinates'],
          properties: {
            type: {
              type: 'string',
              enum: ['Point'],
            },
            coordinates: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'number',
              },
            },
            bbox: {
              type: 'array',
              minItems: 4,
              items: {
                type: 'number',
              },
            },
          },
        },
      },
    };

    const expected = {
      openapi: '3.0.0',
      info: {
        title: 'Sample API',
        version: '0.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      paths: {
        '/points': {
          get: {
            operationId: 'get-points',
            responses: {
              '200': {
                description: 'A JSON array of GeoJSON points',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        title: 'GeoJSON Point',
                        type: 'object',
                        required: ['type', 'coordinates'],
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['Point'],
                          },
                          coordinates: {
                            type: 'array',
                            minItems: 2,
                            items: {
                              type: 'number',
                            },
                          },
                          bbox: {
                            type: 'array',
                            minItems: 4,
                            items: {
                              type: 'number',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result).toEqual(expected);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle multiple x-ext references', () => {
    const input = {
      components: {
        schemas: {
          Dog: {
            $ref: '#/x-ext/dog',
          },
          Cat: {
            $ref: '#/x-ext/cat',
          },
        },
      },
      'x-ext': {
        dog: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            breed: { type: 'string' },
          },
        },
        cat: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.components.schemas.Dog).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        breed: { type: 'string' },
      },
    });
    expect(result.components.schemas.Cat).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        color: { type: 'string' },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle nested x-ext references', () => {
    const input = {
      schema: {
        allOf: [
          {
            $ref: '#/x-ext/base',
          },
          {
            properties: {
              extra: { type: 'string' },
            },
          },
        ],
      },
      'x-ext': {
        base: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.schema.allOf[0]).toEqual({
      type: 'object',
      properties: {
        id: { type: 'integer' },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle arrays with x-ext references', () => {
    const input = {
      items: [{ $ref: '#/x-ext/item1' }, { $ref: '#/x-ext/item2' }],
      'x-ext': {
        item1: { value: 'first' },
        item2: { value: 'second' },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.items).toEqual([{ value: 'first' }, { value: 'second' }]);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle missing x-ext property gracefully', () => {
    const input = {
      openapi: '3.0.0',
      paths: {},
    };

    const result = dereferenceExternalRef(input);

    expect(result).toEqual(input);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle invalid x-ext references gracefully', () => {
    const input = {
      schema: {
        $ref: '#/x-ext/nonexistent',
      },
      'x-ext': {
        test: { type: 'string' },
      },
    };

    const result = dereferenceExternalRef(input);

    // The reference should remain unchanged if it doesn't exist
    expect(result.schema).toEqual({
      $ref: '#/x-ext/nonexistent',
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should recursively dereference nested objects within x-ext', () => {
    const input = {
      schema: {
        $ref: '#/x-ext/outer',
      },
      'x-ext': {
        outer: {
          type: 'object',
          properties: {
            inner: {
              $ref: '#/x-ext/inner',
            },
          },
        },
        inner: {
          type: 'string',
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        inner: {
          type: 'string',
        },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should dereference complex x-ext entries with internal paths', () => {
    const input = {
      openapi: '3.0.2',
      info: { version: '1.0.0', title: 'Swagger Petstore' },
      servers: [{ url: 'http://petstore.swagger.io/v1' }],
      paths: {
        '/pets': {
          post: {
            responses: {
              '200': {
                description: 'Created Pet',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        { $ref: '#/x-ext/cefada3/components/schemas/Pet' },
                      ],
                    },
                  },
                },
              },
            },
          },
          get: {
            responses: {
              '200': {
                description: 'All pets',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        {
                          $ref: '#/x-ext/248c295/components/schemas/AnotherSchema',
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        '248c295': {
          components: {
            schemas: {
              AnotherSchema: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer', format: 'int64' } },
              },
            },
          },
        },
        cefada3: {
          components: {
            schemas: {
              Pet: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer', format: 'int64' },
                  file: {
                    $ref: '#/x-ext/248c295/components/schemas/AnotherSchema',
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input);

    // post -> oneOf[0] should be the Pet schema with file inlined
    const postSchema =
      result.paths['/pets'].post.responses['200'].content['application/json']
        .schema.oneOf[0];
    expect(postSchema).toEqual({
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer', format: 'int64' },
        file: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer', format: 'int64' } },
        },
      },
    });

    // get -> oneOf[0] should be AnotherSchema directly
    const getSchema =
      result.paths['/pets'].get.responses['200'].content['application/json']
        .schema.oneOf[0];
    expect(getSchema).toEqual({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer', format: 'int64' } },
    });

    expect(result).not.toHaveProperty('x-ext');
  });
});
