import type { OpenApiDocument } from '@orval/core';
import * as orvalCore from '@orval/core';
import { describe, expect, it, vi } from 'vitest';

import {
  dereferenceExternalRef,
  importSpecs,
  validateComponentKeys,
} from './import-specs';
import { normalizeOptions } from './utils';

const TEST_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Single Route API',
    version: '1.0.0',
  },
  paths: {
    '/{workspace_id}/resource/{id}': {
      post: {
        summary: 'Single endpoint with optional inputs',
        operationId: 'handleResource',
        parameters: [
          {
            name: 'workspace_id',
            in: 'path',
            required: true,
            description:
              'Path identifier (logically optional, but required by OpenAPI)',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'id',
            in: 'path',
            required: true,
            description:
              'Path identifier (logically optional, but required by OpenAPI)',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'filter',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
          },
          {
            name: 'X-Request-Mode',
            in: 'header',
            required: false,
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
          },
        },
      },
    },
  },
};

const SSE_ITEM_SCHEMA_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'FastAPI',
    version: '0.1.0',
  },
  paths: {
    '/api/events/': {
      post: {
        tags: ['stream'],
        summary: 'Sse Endpoint',
        operationId: 'sse_endpoint',
        responses: {
          '200': {
            description: 'Successful Response',
            content: {
              'text/event-stream': {
                itemSchema: {
                  type: 'object',
                  properties: {
                    data: { type: 'string' },
                    event: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/pets': {
      get: {
        tags: ['pets'],
        summary: 'List Pets',
        operationId: 'list_pets',
        responses: {
          '200': {
            description: 'Successful Response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
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

describe('validation', () => {
  it('should throw on non-standard fields like itemSchema by default', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: SSE_ITEM_SCHEMA_SPEC },
      },
      workspace,
      {},
    );

    await expect(importSpecs(workspace, normalizedOptions)).rejects.toThrow(
      'OpenAPI spec validation failed',
    );
  });

  it('should skip validation when input.unsafeDisableValidation is true', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: SSE_ITEM_SCHEMA_SPEC, unsafeDisableValidation: true },
      },
      workspace,
      {},
    );

    expect(normalizedOptions.input.unsafeDisableValidation).toBe(true);

    const warnSpy = vi.spyOn(orvalCore, 'logWarning').mockImplementation(() => {
      /* noop */
    });

    try {
      const spec = await importSpecs(workspace, normalizedOptions);

      expect(spec.verbOptions).toHaveProperty('sse_endpoint');
      expect(spec.verbOptions).toHaveProperty('list_pets');

      const warnings = warnSpy.mock.calls.map(([msg]) => msg).join('\n');
      expect(warnings).toContain('OpenAPI spec validation is disabled');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('optionsParamRequired', () => {
  it('should not require all params when optionsParamRequired is false', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: {
          target: '',
        },
        input: {
          target: TEST_SPEC,
        },
      },
      workspace,
      {},
    );
    const spec = await importSpecs(workspace, normalizedOptions);

    const body = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'handleResourceBody',
    );
    expect(body).toBeDefined();
    expect(body).toBeTypeOf('object');
    expect(body).not.toBeNull();

    expect(body?.name).toBe('handleResourceBody');
    expect(body?.definition).toBe('handleResourceBody?: HandleResourceBody');
    expect(body?.implementation).toBe(
      'handleResourceBody?: HandleResourceBody',
    );
    expect(body?.default).toBe(false);
    expect(body?.required).toBe(false);
    expect(body?.type).toBe('body');

    const params = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'params',
    );
    expect(params).toBeDefined();
    expect(params).toBeTypeOf('object');
    expect(params).not.toBeNull();

    expect(params?.name).toBe('params');
    expect(params?.definition).toBe('params?: HandleResourceParams');
    expect(params?.implementation).toBe('params?: HandleResourceParams');
    expect(params?.default).toBe(false);
    expect(params?.required).toBe(false);
    expect(params?.type).toBe('queryParam');

    const implementation = spec.operations.handleResource.implementation;
    expect(implementation).toBeDefined();

    const expectedImplementation = `/**
 * @summary Single endpoint with optional inputs
 */
export const handleResource = (
    workspaceId: string,
    id: string,
    handleResourceBody?: HandleResourceBody,
    params?: HandleResourceParams, options?: AxiosRequestConfig
 ): Promise<AxiosResponse<void>> => {
    return axios.post(
      \`/\${workspaceId}/resource/\${id}\`,
      handleResourceBody,{
    ...options,
        params: {...params, ...options?.params},}
    );
  }
`;

    expect(implementation).toBe(expectedImplementation);
  });

  it('should require all params when optionsParamRequired is true', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: {
          optionsParamRequired: true,
          target: '',
        },
        input: {
          target: TEST_SPEC,
        },
      },
      workspace,
      {},
    );
    const spec = await importSpecs(workspace, normalizedOptions);
    expect(normalizedOptions.output.optionsParamRequired).toBe(true);

    const body = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'handleResourceBody',
    );
    expect(body).toBeDefined();
    expect(body).toBeTypeOf('object');
    expect(body).not.toBeNull();

    expect(body?.name).toBe('handleResourceBody');
    expect(body?.definition).toBe('handleResourceBody: HandleResourceBody');
    expect(body?.implementation).toBe('handleResourceBody: HandleResourceBody');
    expect(body?.default).toBe(false);
    expect(body?.required).toBe(true);
    expect(body?.type).toBe('body');

    const params = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'params',
    );
    expect(params).toBeDefined();
    expect(params).toBeTypeOf('object');
    expect(params).not.toBeNull();

    expect(params?.name).toBe('params');
    expect(params?.definition).toBe('params: HandleResourceParams');
    expect(params?.implementation).toBe('params: HandleResourceParams');
    expect(params?.default).toBe(false);
    expect(params?.required).toBe(true);
    expect(params?.type).toBe('queryParam');

    const implementation = spec.operations.handleResource.implementation;
    expect(implementation).toBeDefined();

    const expectedImplementation = `/**
 * @summary Single endpoint with optional inputs
 */
export const handleResource = (
    workspaceId: string,
    id: string,
    handleResourceBody: HandleResourceBody,
    params: HandleResourceParams, options: AxiosRequestConfig
 ): Promise<AxiosResponse<void>> => {
    return axios.post(
      \`/\${workspaceId}/resource/\${id}\`,
      handleResourceBody,{
    ...options,
        params: {...params, ...options?.params},}
    );
  }
`;

    expect(implementation).toBe(expectedImplementation);
  });
});

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
      components: {
        schemas: {},
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

    const result = dereferenceExternalRef(input) as {
      components: { schemas: Record<string, unknown> };
    };

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

    const result = dereferenceExternalRef(input) as {
      schema: { allOf: unknown[] };
    };

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

  it('should dereference x-ext entry with internal paths', () => {
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
                      $ref: '#/x-ext/cefada3/components/schemas/Pet',
                    },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        cefada3: {
          components: {
            schemas: {
              Pet: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer', format: 'int64' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // Schemas from external docs should be merged into components
    expect(result.components?.schemas).toHaveProperty('Pet');
    expect(result.paths?.['/pets']?.post?.responses?.['200']?.content).toEqual({
      'application/json': {
        schema: {
          // updated from '#/x-ext/cefada3/components/schemas/Pet'
          $ref: '#/components/schemas/Pet',
        },
      },
    });

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should dereference external doc schemas with internal refs', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      components: {
        schemas: {
          ExternalSchema: {
            $ref: '#/x-ext/external-doc/components/schemas/ExternalSchema',
          },
        },
      },
      'x-ext': {
        'external-doc': {
          openapi: '3.0.3',
          info: { title: 'External API', version: '0.0.0' },
          components: {
            schemas: {
              ExternalSchema: {
                type: 'object',
                required: ['version'],
                allOf: [
                  { $ref: '#/components/schemas/Version' },
                  { $ref: '#/components/schemas/FirstValue' },
                ],
              },
              Version: {
                type: 'object',
                properties: {
                  version: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
              FirstValue: {
                type: 'object',
                properties: {
                  first: { type: 'number', format: 'double', example: 5.2 },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;
    const schemas = result.components?.schemas;

    // --- Assert: All 3 schemas merged from external doc ---
    expect(schemas).toHaveProperty('ExternalSchema');
    expect(schemas).toHaveProperty('Version');
    expect(schemas).toHaveProperty('FirstValue');

    expect(schemas?.ExternalSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['version'],
        allOf: [
          expect.objectContaining({ $ref: '#/components/schemas/Version' }),
          expect.objectContaining({ $ref: '#/components/schemas/FirstValue' }),
        ],
      }),
    );

    expect(result).not.toHaveProperty('x-ext');
  });

  // Regression test for https://github.com/orval-labs/orval/issues/394
  it('should resolve internal $ref inside an external parameter against the external doc', () => {
    const input = {
      openapi: '3.0.2',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {
        '/path': {
          get: {
            parameters: [{ $ref: '#/x-ext/refs/components/parameters/switch' }],
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        refs: {
          components: {
            schemas: {
              Switch: {
                type: 'string',
                enum: ['on', 'off'],
              },
            },
            parameters: {
              switch: {
                name: 'switch',
                in: 'query',
                schema: { $ref: '#/components/schemas/Switch' },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // The Switch schema from the external doc should be merged into main
    // components with its content intact
    expect(result.components?.schemas?.Switch).toEqual({
      type: 'string',
      enum: ['on', 'off'],
    });

    // The parameter should be inlined where the x-ext ref was, and its
    // internal $ref must still point to Switch (now in the main spec)
    const params = result.paths?.['/path']?.get?.parameters;
    expect(params).toEqual([
      expect.objectContaining({
        name: 'switch',
        in: 'query',
        schema: { $ref: '#/components/schemas/Switch' },
      }),
    ]);

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle schema name collisions - add suffix to external schema', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      components: {
        schemas: {
          // Main spec has its own User schema
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
      'x-ext': {
        external: {
          components: {
            schemas: {
              // External doc also has User, but different structure
              User: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  age: { type: 'number' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    expect(result.components?.schemas).toHaveProperty('User_external');
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle schema collisions between multiple external docs', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      'x-ext': {
        'external-1': {
          components: {
            schemas: {
              SharedSchema: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['external-1'] },
                },
              },
            },
          },
        },
        'external-2': {
          components: {
            schemas: {
              SharedSchema: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['external-2'] },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // First external doc's SharedSchema (no suffix - arrived first)
    expect(result.components?.schemas).toHaveProperty('SharedSchema');

    // Second external doc's SharedSchema (suffixed due to collision)
    expect(result.components?.schemas).toHaveProperty(
      'SharedSchema_external_2',
    );

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should break cycles when an external ref recursively points back to itself (#1642)', () => {
    // A self-referencing x-ext entry outside components.schemas would
    // otherwise inline forever and OOM; the inner ref must collapse to `{}`.
    const warnSpy = vi.spyOn(orvalCore, 'logWarning').mockImplementation(() => {
      /* noop */
    });

    const input = {
      openapi: '3.0.0',
      components: {
        schemas: {
          Foo: { $ref: '#/x-ext/abc/Foo' },
        },
      },
      'x-ext': {
        abc: {
          Foo: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              self: { $ref: '#/x-ext/abc/Foo' },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      components: { schemas: { Foo: Record<string, unknown> } };
    };

    expect(result.components.schemas.Foo).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        self: {},
      },
    });
    expect(result).not.toHaveProperty('x-ext');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('circular external $ref'),
    );

    warnSpy.mockRestore();
  });

  it('should not inject components into Swagger 2.0 spec when no external refs exist', () => {
    const input = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      definitions: { Foo: { type: 'object' } },
    };

    const result = dereferenceExternalRef(input);

    expect(result).not.toHaveProperty('components');
  });
});

describe('validateComponentKeys', () => {
  it('should pass for valid ASCII component keys', () => {
    const data = {
      components: {
        schemas: {
          User: { type: 'object' },
          User_v2: { type: 'object' },
          'my.org.User': { type: 'object' },
          'user-name': { type: 'object' },
        },
      },
    };
    expect(() => {
      validateComponentKeys(data);
    }).not.toThrow();
  });

  it('should report all invalid keys at once', () => {
    const data = {
      components: {
        schemas: {
          Användare: { type: 'object' },
          상품: { type: 'object' },
        },
      },
    };
    expect(() => {
      validateComponentKeys(data);
    }).toThrow(/Invalid component keys/);
  });

  it.each([
    ['schemas', { Ünvalid: {} }],
    ['responses', { Réponse: {} }],
    ['parameters', { パラメータ: {} }],
    ['examples', { 例子: {} }],
    ['requestBodies', { тело: {} }],
    ['headers', { κεφαλίδα: {} }],
    ['securitySchemes', { sécurité: {} }],
    ['links', { länk: {} }],
    ['callbacks', { رد: {} }],
    ['pathItems', { เส้นทาง: {} }],
  ])('should reject invalid key in %s', (section, value) => {
    const data = { components: { [section]: value } };
    expect(() => {
      validateComponentKeys(data);
    }).toThrow(new RegExp(String.raw`components\.${section}\.`));
  });

  it('should pass when no components exist', () => {
    const data = { openapi: '3.0.0', paths: {} };
    expect(() => {
      validateComponentKeys(data);
    }).not.toThrow();
  });
});
