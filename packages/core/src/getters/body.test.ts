import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
  ReadonlyRequestBodiesMode,
} from '../types';
import { getBody } from './body';

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
