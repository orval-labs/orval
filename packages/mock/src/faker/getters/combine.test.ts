import {
  type ContextSpec,
  EnumGeneration,
  FormDataArrayHandling,
  type GeneratorImport,
  NamingConvention,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  PropertySortOrder,
} from '@orval/core';
import { describe, expect, it } from 'vitest';

import type { MockSchemaObject } from '../../types';
import { combineSchemasMock } from './combine';

function createMockContext(): ContextSpec {
  return {
    target: 'test',
    workspace: 'test',
    spec: { openapi: '3.1.0', info: { title: 'Test' }, paths: {} },
    output: {
      target: '',
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      mode: OutputMode.SINGLE,
      client: OutputClient.FETCH,
      httpClient: OutputHttpClient.FETCH,
      clean: false,
      docs: false,
      prettier: false,
      biome: false,
      headers: false,
      indexFiles: false,
      allParamsOptional: false,
      urlEncodeParameters: false,
      unionAddMissingProperties: false,
      optionsParamRequired: false,
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
      override: {
        title: undefined,
        transformer: undefined,
        mutator: undefined,
        operations: {},
        tags: {},
        mock: undefined,
        contentType: undefined,
        header: false,
        formData: {
          disabled: false,
          arrayHandling: FormDataArrayHandling.SERIALIZE,
        },
        formUrlEncoded: false,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
        namingConvention: {},
        components: {
          schemas: { suffix: '', itemSuffix: '' },
          responses: { suffix: '' },
          parameters: { suffix: '' },
          requestBodies: { suffix: '' },
        },
        hono: { compositeRoute: '', validator: false, validatorOutputPath: '' },
        query: {
          useQuery: false,
          useSuspenseQuery: false,
          useMutation: false,
          useInfinite: false,
          useSuspenseInfiniteQuery: false,
          useInfiniteQueryParam: '',
          usePrefetch: false,
          useInvalidate: false,
          shouldExportMutatorHooks: false,
          shouldExportHttpClient: false,
          shouldExportQueryKey: false,
          shouldSplitQueryKey: false,
          useOperationIdAsQueryKey: false,
          signal: false,
          version: 5,
        },
        angular: { provideIn: 'root' },
        swr: {},
        zod: {
          strict: {
            param: false,
            query: false,
            header: false,
            body: false,
            response: false,
          },
          generate: {
            param: false,
            query: false,
            header: false,
            body: false,
            response: false,
          },
          coerce: {
            param: false,
            query: false,
            header: false,
            body: false,
            response: false,
          },
          generateEachHttpStatus: false,
          dateTimeOptions: {},
          timeOptions: { precision: 3 },
        },
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
        },
        enumGenerationType: EnumGeneration.UNION,
        jsDoc: {},
        requestOptions: true,
      },
    },
  };
}

describe('combineSchemasMock', () => {
  it('should combine allOf schemas with primitive values', () => {
    const item: MockSchemaObject = {
      name: 'User',
      allOf: [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'integer' } } },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBeTruthy();
    expect(result.imports).toBeInstanceOf(Array);
    expect(result.name).toBe('User');
  });

  it('should combine oneOf schemas', () => {
    const item: MockSchemaObject = {
      name: 'Response',
      oneOf: [
        {
          type: 'object',
          properties: { type: { type: 'string', enum: ['success'] } },
        },
        {
          type: 'object',
          properties: { type: { type: 'string', enum: ['error'] } },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toContain('faker.helpers.arrayElement');
  });

  it('should combine anyOf schemas', () => {
    const item: MockSchemaObject = {
      name: 'Config',
      anyOf: [
        { type: 'string' },
        { type: 'object', properties: { value: { type: 'string' } } },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'anyOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Config');
  });

  it('should skip already referenced properties in allOf', () => {
    const item: MockSchemaObject = {
      name: 'Extended',
      properties: { base: { type: 'string' } },
      allOf: [{ type: 'object', properties: { extra: { type: 'string' } } }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['Extended'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    // The combined included properties should contain the original property keys
    expect(result.includedProperties).toContain('base');
  });

  it('should handle empty combination arrays', () => {
    const item: MockSchemaObject = {
      name: 'Empty',
      allOf: [],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBeDefined();
  });

  it('should merge required fields from parent with child schema in allOf', () => {
    const item: MockSchemaObject = {
      name: 'Parent',
      required: ['parentField'],
      allOf: [
        {
          type: 'object',
          properties: { childField: { type: 'string' } },
          required: ['childField'],
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.includedProperties).toBeDefined();
  });

  it('should return empty arrayElement when oneOf contains only circular references', () => {
    const item: MockSchemaObject = {
      name: 'Test',
      oneOf: [{ $ref: '#/components/schemas/ExistingRef' }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['ExistingRef'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBe('faker.helpers.arrayElement([])');
  });

  it('should collect imports from combined schemas', () => {
    const mockImports: GeneratorImport[] = [
      { name: 'TestType', default: false },
    ];

    const item: MockSchemaObject = {
      name: 'WithImports',
      allOf: [{ type: 'object', properties: { field: { type: 'string' } } }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: mockImports,
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.imports).toBeInstanceOf(Array);
  });

  it('should handle nested allOf combinations', () => {
    const item: MockSchemaObject = {
      name: 'Nested',
      allOf: [
        {
          type: 'object',
          properties: {
            level1: { type: 'string' },
          },
        },
        {
          type: 'object',
          properties: {
            level2: { type: 'string' },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).not.toBe('undefined');
  });

  it('should resolve allOf base schema even when base was seen in different branch', () => {
    const contextWithSchemas: ContextSpec = {
      ...createMockContext(),
      spec: {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Base: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'Cat',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/Base' },
        {
          type: 'object',
          properties: { meow: { type: 'boolean' } },
          required: ['meow'],
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: contextWithSchemas,
      imports: [],
      existingReferencedProperties: ['Response', 'Dog', 'Base', 'Shelter'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).not.toBe('undefined');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('name:');
    expect(result.value).toContain('meow:');
  });

  it('should return empty arrayElement for oneOf with circular references', () => {
    const item: MockSchemaObject = {
      name: 'Pet',
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['Cat'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBe('faker.helpers.arrayElement([])');
  });
});
