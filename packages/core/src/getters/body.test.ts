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
