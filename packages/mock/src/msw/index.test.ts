import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterBody,
  GetterResponse,
  NormalizedOutputOptions,
  NormalizedOverrideOutput,
  OpenApiDocument,
  OpenApiOperationObject,
  OpenApiRequestBodyObject,
  ResReqTypesValue,
} from '@orval/core';
import {
  EnumGeneration,
  FormDataArrayHandling,
  NamingConvention,
  OutputClient,
  OutputHttpClient,
  OutputMockType,
  OutputMode,
  PropertySortOrder,
} from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateMSW } from './index';

describe('generateMSW', () => {
  const mockResponseType: ResReqTypesValue = {
    value: 'User',
    isEnum: false,
    hasReadonlyProps: false,
    type: 'object',
    imports: [],
    schemas: [],
    isRef: false,
    dependencies: [],
    key: '200',
    contentType: 'application/json',
  };

  const mockErrorType: ResReqTypesValue = {
    value: 'Error',
    isEnum: false,
    hasReadonlyProps: false,
    type: 'object',
    imports: [],
    schemas: [],
    isRef: false,
    dependencies: [],
    key: 'default',
    contentType: 'application/json',
  };

  const mockResponse: GetterResponse = {
    imports: [],
    definition: { success: 'User', errors: 'Error' },
    isBlob: false,
    types: { success: [mockResponseType], errors: [mockErrorType] },
    contentTypes: ['application/json'],
    schemas: [],
  };

  const mockBody: GetterBody = {
    originalSchema: {} as OpenApiRequestBodyObject,
    imports: [],
    definition: '',
    implementation: '',
    schemas: [],
    contentType: 'application/json',
    isOptional: true,
  };

  const baseOverride: NormalizedOverrideOutput = {
    operations: {},
    tags: {},
    formData: {
      disabled: true,
      arrayHandling: FormDataArrayHandling.SERIALIZE,
    },
    formUrlEncoded: true,
    namingConvention: {},
    components: {
      schemas: { suffix: 'Schema', itemSuffix: 'Item' },
      responses: { suffix: 'Response' },
      parameters: { suffix: 'Parameter' },
      requestBodies: { suffix: 'RequestBody' },
    },
    hono: { compositeRoute: '', validator: true, validatorOutputPath: '' },
    query: {},
    angular: {
      provideIn: 'root',
      client: 'httpClient',
      runtimeValidation: true,
    },
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
        param: true,
        query: true,
        header: true,
        body: true,
        response: true,
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
      timeOptions: {},
    },
    fetch: {
      includeHttpResponseReturnType: true,
      forceSuccessResponse: false,
      runtimeValidation: false,
    },
    header: false,
    requestOptions: true,
    enumGenerationType: EnumGeneration.CONST,
    jsDoc: {},
    aliasCombinedTypes: false,
  };

  const baseOutput: NormalizedOutputOptions = {
    target: './out.ts',
    namingConvention: NamingConvention.CAMEL_CASE,
    fileExtension: '.ts',
    mode: OutputMode.SINGLE,
    mock: undefined,
    override: baseOverride,
    client: OutputClient.AXIOS,
    httpClient: OutputHttpClient.AXIOS,
    clean: false,
    docs: false,
    prettier: false,
    biome: false,
    headers: false,
    indexFiles: true,
    allParamsOptional: false,
    urlEncodeParameters: false,
    unionAddMissingProperties: false,
    optionsParamRequired: false,
    propertySortOrder: PropertySortOrder.SPECIFICATION,
  };

  const baseContext: ContextSpec = {
    spec: {} as OpenApiDocument,
    target: baseOutput.target,
    workspace: process.cwd(),
    output: baseOutput,
  };

  const mockVerbOptions: GeneratorVerbOptions = {
    operationId: 'getUser',
    operationName: 'getUser',
    verb: 'get',
    route: '/users/{id}',
    pathRoute: '/users/{id}',
    doc: '',
    tags: [],
    response: mockResponse,
    body: mockBody,
    params: [],
    props: [],
    override: baseOverride,
    originalOperation: {} as OpenApiOperationObject,
  };

  const baseOptions: GeneratorOptions = {
    route: '/users/{id}',
    pathRoute: '/users/{id}',
    override: baseOverride,
    context: baseContext,
    output: baseOutput.target,
  };

  const generate = (overrides: Partial<GeneratorOptions> = {}) =>
    generateMSW(mockVerbOptions, { ...baseOptions, ...overrides });

  describe('delay functionality', () => {
    it('should not include delay call when no delay is provided', () => {
      const result = generate();
      expect(result.implementation.handler).not.toContain('await delay');
    });

    it('should include delay call when delay is a number', () => {
      const result = generate({
        mock: { type: OutputMockType.MSW, delay: 100 },
      });
      expect(result.implementation.handler).toContain('await delay(100);');
    });

    it('should not include delay call when delay is false', () => {
      const result = generate({
        mock: { type: OutputMockType.MSW, delay: false },
      });
      expect(result.implementation.handler).not.toContain('await delay');
    });

    it('should execute delay function immediately when delayFunctionLazyExecute is false', () => {
      const result = generate({
        mock: {
          type: OutputMockType.MSW,
          delay: () => 200,
          delayFunctionLazyExecute: false,
        },
      });
      expect(result.implementation.handler).toContain('await delay(200);');
    });

    it('should preserve delay function when delayFunctionLazyExecute is true', () => {
      const result = generate({
        mock: {
          type: OutputMockType.MSW,
          delay: () => Number(process.env.MSW_DELAY) || 10,
          delayFunctionLazyExecute: true,
        },
      });
      expect(result.implementation.handler).toContain(
        'await delay((() => Number(process.env.MSW_DELAY) || 10)());',
      );
    });

    it('should handle delay function in override.mock', () => {
      const result = generate({
        override: {
          ...baseOptions.override,
          mock: { delay: () => 300, delayFunctionLazyExecute: true },
        },
      });
      expect(result.implementation.handler).toContain(
        'await delay((() => 300)());',
      );
    });

    it('should prioritize override.mock.delay over options.mock.delay', () => {
      const result = generate({
        mock: { type: OutputMockType.MSW, delay: 100 },
        override: { ...baseOptions.override, mock: { delay: 500 } },
      });
      expect(result.implementation.handler).toContain('await delay(500);');
      expect(result.implementation.handler).not.toContain('await delay(100);');
    });

    it('should prioritize override.mock.delayFunctionLazyExecute', () => {
      const result = generate({
        mock: {
          type: OutputMockType.MSW,
          delay: () => 100,
          delayFunctionLazyExecute: false,
        },
        override: {
          ...baseOptions.override,
          mock: { delay: () => 200, delayFunctionLazyExecute: true },
        },
      });
      expect(result.implementation.handler).toContain(
        'await delay((() => 200)());',
      );
    });
  });

  describe('handler generation', () => {
    it('should generate a valid MSW handler', () => {
      const result = generate({
        mock: { type: OutputMockType.MSW, delay: 100 },
      });

      expect(result.implementation.handlerName).toBe('getGetUserMockHandler');
      expect(result.implementation.handler).toContain(
        'export const getGetUserMockHandler',
      );
      expect(result.implementation.handler).toContain('return http.get');
      expect(result.implementation.handler).toContain(
        'return new HttpResponse',
      );
    });
  });
});
