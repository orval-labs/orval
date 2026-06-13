import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
  ReadonlyRequestBodiesMode,
} from '../types';
import { getBodiesByContentType, getBody } from './body';

const schemaWithReadOnly: OpenApiSchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    name: { type: 'string' },
  },
  required: ['name'],
};

const createContext = (
  preserveReadonlyRequestBodies: ReadonlyRequestBodiesMode = 'strip',
): ContextSpec =>
  ({
    output: {
      override: {
        formData: { arrayHandling: 'serialize', disabled: true },
        formUrlEncoded: true,
        namingConvention: {},
        enumGenerationType: 'const',
        preserveReadonlyRequestBodies,
        components: {
          schemas: { suffix: '', itemSuffix: 'Item' },
          responses: { suffix: '' },
          parameters: { suffix: '' },
          requestBodies: { suffix: 'Body' },
        },
      },
    },
    target: 'spec',
    workspace: '',
    spec: {
      openapi: '3.1.0',
      info: { title: 'Spec', version: '1.0.0' },
      paths: {},
      components: { schemas: {} },
    },
  }) as ContextSpec;

describe('getBody', () => {
  const requestBody: OpenApiRequestBodyObject = {
    content: {
      'application/json': {
        schema: schemaWithReadOnly,
      },
    },
    required: true,
  };

  it('removes readonly request-body modifiers by default', () => {
    const result = getBody({
      requestBody,
      operationName: 'createPet',
      context: createContext(),
    });

    expect(result.definition).toContain('NonReadonly<');
  });

  it('preserves readonly request-body modifiers when configured', () => {
    const result = getBody({
      requestBody,
      operationName: 'createPet',
      context: createContext('preserve'),
    });

    expect(result.definition).not.toContain('NonReadonly<');
    expect(result.definition).toBe('CreatePetBody');
  });

  it('treats request bodies without an explicit required flag as optional', () => {
    const result = getBody({
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
          },
        },
      },
      operationName: 'searchPets',
      context: createContext(),
    });

    expect(result.isOptional).toBe(true);
  });

  it('treats referenced request bodies without an explicit required flag as optional', () => {
    const context = createContext();
    context.spec.components = {
      ...context.spec.components,
      requestBodies: {
        SearchPetsBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = getBody({
      requestBody: { $ref: '#/components/requestBodies/SearchPetsBody' },
      operationName: 'searchPets',
      context,
    });

    expect(result.isOptional).toBe(true);
  });

  it('treats referenced request bodies marked required as non-optional', () => {
    const context = createContext();
    context.spec.components = {
      ...context.spec.components,
      requestBodies: {
        CreatePetsBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = getBody({
      requestBody: { $ref: '#/components/requestBodies/CreatePetsBody' },
      operationName: 'createPets',
      context,
    });

    expect(result.isOptional).toBe(false);
  });

  // Regression: #2028 — when an OpenAPI 3.0 spec leaves `required` off the
  // requestBody, orval used to emit a required body parameter. The fix in
  // PR #3263 treats `required !== true` as optional. This test pins the
  // exact shape from #2028: an inline requestBody whose content schema is a
  // `$ref` to components/schemas (not a $ref on the requestBody itself).
  it('treats inline request bodies with a $ref schema and no required flag as optional (#2028)', () => {
    const context = createContext();
    context.spec.components = {
      ...context.spec.components,
      schemas: {
        ...context.spec.components?.schemas,
        BodyDto: {
          type: 'object',
          properties: {
            x: { type: 'string' },
          },
        },
      },
    };

    const result = getBody({
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BodyDto' },
          },
        },
      },
      operationName: 'createThing',
      context,
    });

    expect(result.isOptional).toBe(true);
  });

  it('treats referenced request bodies marked required: false as optional', () => {
    const context = createContext();
    context.spec.components = {
      ...context.spec.components,
      requestBodies: {
        SearchPetsBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = getBody({
      requestBody: { $ref: '#/components/requestBodies/SearchPetsBody' },
      operationName: 'searchPets',
      context,
    });

    expect(result.isOptional).toBe(true);
  });

  describe('x-codegen-request-body-name', () => {
    it('uses custom name from inline request body extension', () => {
      const result = getBody({
        requestBody: {
          'x-codegen-request-body-name': 'petData',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
          required: true,
        },
        operationName: 'createPet',
        context: createContext(),
      });

      expect(result.implementation).toBe('petData');
    });

    it('uses custom name from referenced request body extension', () => {
      const context = createContext();
      context.spec.components = {
        ...context.spec.components,
        requestBodies: {
          CreatePetBody: {
            'x-codegen-request-body-name': 'resource',
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
        },
      };

      const result = getBody({
        requestBody: { $ref: '#/components/requestBodies/CreatePetBody' },
        operationName: 'createPet',
        context,
      });

      expect(result.implementation).toBe('resource');
    });

    it('falls back to default naming when extension is absent', () => {
      const result = getBody({
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
          required: true,
        },
        operationName: 'createPet',
        context: createContext(),
      });

      expect(result.implementation).toBe('createPetBody');
    });

    it('sanitizes the extension value through standard naming pipeline', () => {
      const result = getBody({
        requestBody: {
          'x-codegen-request-body-name': 'my-body',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
          required: true,
        },
        operationName: 'createPet',
        context: createContext(),
      });

      expect(result.implementation).toBe('myBody');
    });

    it('falls back to default naming when extension is non-string', () => {
      const result = getBody({
        requestBody: {
          'x-codegen-request-body-name': 123 as unknown as string,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
          required: true,
        },
        operationName: 'createPet',
        context: createContext(),
      });

      expect(result.implementation).toBe('createPetBody');
    });
  });
});

describe('getBodiesByContentType', () => {
  const multiContentTypeRequestBody: OpenApiRequestBodyObject = {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
    required: true,
  };

  const singleContentTypeRequestBody: OpenApiRequestBodyObject = {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
    required: true,
  };

  it('returns a single entry with empty suffix when only one content type', () => {
    const result = getBodiesByContentType({
      requestBody: singleContentTypeRequestBody,
      operationName: 'updateProfile',
      context: createContext(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].contentTypeSuffix).toBe('');
  });

  it('returns separate entries per content type when multiple content types', () => {
    const result = getBodiesByContentType({
      requestBody: multiContentTypeRequestBody,
      operationName: 'updateProfile',
      context: createContext(),
    });

    expect(result).toHaveLength(2);
    expect(result[0].contentTypeSuffix).toBe('Json');
    expect(result[1].contentTypeSuffix).toBe('FormData');
  });

  it('maps known content types to correct suffixes', () => {
    const requestBody: OpenApiRequestBodyObject = {
      content: {
        'application/json': {
          schema: { type: 'object', properties: { a: { type: 'string' } } },
        },
        'application/xml': {
          schema: { type: 'object', properties: { a: { type: 'string' } } },
        },
        'application/octet-stream': {
          schema: { type: 'string', format: 'binary' },
        },
      },
      required: true,
    };

    const result = getBodiesByContentType({
      requestBody,
      operationName: 'testOp',
      context: createContext(),
    });

    expect(result).toHaveLength(3);
    expect(result[0].contentTypeSuffix).toBe('Json');
    expect(result[1].contentTypeSuffix).toBe('Xml');
    expect(result[2].contentTypeSuffix).toBe('Blob');
  });

  it('derives PascalCase suffix for unknown content types', () => {
    const requestBody: OpenApiRequestBodyObject = {
      content: {
        'application/json': {
          schema: { type: 'object', properties: { a: { type: 'string' } } },
        },
        'application/vnd.api+json': {
          schema: { type: 'object', properties: { a: { type: 'string' } } },
        },
      },
      required: true,
    };

    const result = getBodiesByContentType({
      requestBody,
      operationName: 'testOp',
      context: createContext(),
    });

    expect(result).toHaveLength(2);
    expect(result[0].contentTypeSuffix).toBe('Json');
    expect(result[1].contentTypeSuffix).toBe('VndApiJson');
  });
});
