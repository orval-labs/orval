import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { OutputMockType } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateMSW } from './index';

describe('generateMSW', () => {
  const mockVerbOptions = {
    operationId: 'getUser',
    verb: 'get',
    tags: [],
    response: {
      imports: [],
      definition: { success: 'User' },
      types: { success: [{ key: '200', value: 'User' }] },
      contentTypes: ['application/json'],
    },
  } as unknown as GeneratorVerbOptions;

  const baseOptions = {
    route: '/users/{id}',
    pathRoute: '/users/{id}',
    output: 'test',
    override: { operations: {}, tags: {} } as NormalizedOverrideOutput,
    context: {
      target: 'test',
      workspace: '',
      spec: {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      },
      output: {
        target: 'test',
        namingConvention: 'camelCase',
        fileExtension: '.ts',
        mode: 'single',
        override: { operations: {}, tags: {} } as NormalizedOverrideOutput,
        client: 'axios-functions',
        httpClient: 'fetch',
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
        propertySortOrder: 'specification',
      },
    },
  } as unknown as GeneratorOptions;

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
          delay: () => 10,
          delayFunctionLazyExecute: true,
        },
      });
      expect(result.implementation.handler).toContain(
        'await delay((() => 10)());',
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
    });

    it('should not include JSON.stringify in handler (uses HttpResponse.json or null body)', () => {
      const result = generate();

      // When there is no mock data, handler returns HttpResponse with null body
      // When there IS mock data, handler should use HttpResponse.json (not JSON.stringify)
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('should handle binary/Blob response types without JSON.stringify', () => {
      const blobVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: {
            success: [{ key: '200', value: 'Blob' }],
          },
          contentTypes: ['application/octet-stream'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(blobVerbOptions, baseOptions);

      expect(result.implementation.handler).not.toContain('JSON.stringify');
      expect(result.implementation.handler).toContain(
        'application/octet-stream',
      );
      // Mock function signature should use Record<string, unknown> instead of Blob
      expect(result.implementation.handler).not.toContain(
        'overrideResponse?: Blob',
      );
    });

    it('should handle image content types as binary', () => {
      const imageVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: {
            success: [{ key: '200', value: 'Blob' }],
          },
          contentTypes: ['image/png'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(imageVerbOptions, baseOptions);

      expect(result.implementation.handler).not.toContain('JSON.stringify');
      expect(result.implementation.handler).toContain('image/png');
    });

    it('should use HttpResponse.text for text/plain responses', () => {
      const textVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(textVerbOptions, baseOptions);

      expect(result.implementation.handler).toContain('HttpResponse.text');
      expect(result.implementation.handler).toContain('textBody');
      expect(result.implementation.handler).toContain('JSON.stringify');
      expect(result.implementation.handler).not.toContain('HttpResponse.json');
    });

    it('should avoid undefined array min/max in general JS types', () => {
      const numberArrayVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'number[]' },
          types: { success: [{ key: '200', value: 'number[]' }] },
          contentTypes: ['application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(numberArrayVerbOptions, baseOptions);

      expect(result.implementation.function).toContain(
        'Array.from({length: faker.number.int()}',
      );
      expect(result.implementation.function).not.toContain('undefined');
    });

    it('should include array min/max when provided for general JS types', () => {
      const numberArrayVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'number[]' },
          types: { success: [{ key: '200', value: 'number[]' }] },
          contentTypes: ['application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(numberArrayVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          mock: { arrayMin: 1, arrayMax: 3 },
        },
      });

      expect(result.implementation.function).toContain(
        'faker.number.int({min: 1, max: 3})',
      );
    });
  });
});
