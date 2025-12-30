import type { GeneratorOptions, GeneratorVerbOptions } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateMSW } from './index';

describe('generateMSW', () => {
  const mockVerbOptions: GeneratorVerbOptions = {
    operationId: 'getUser',
    verb: 'get',
    tags: [],
    response: {
      imports: [],
      definition: { success: 'User' },
      types: { success: [{ key: '200', value: 'User' }] },
      contentTypes: ['application/json'],
    },
  } as GeneratorVerbOptions;

  const baseOptions: GeneratorOptions = {
    pathRoute: '/users/{id}',
    override: { operations: {}, tags: {} },
    context: {
      specs: { test: {} },
      output: { override: {} },
    },
  } as GeneratorOptions;

  const generate = (overrides: Partial<GeneratorOptions> = {}) =>
    generateMSW(mockVerbOptions, { ...baseOptions, ...overrides });

  describe('delay functionality', () => {
    it('should not include delay call when no delay is provided', () => {
      const result = generate();
      expect(result.implementation.handler).not.toContain('await delay');
    });

    it('should include delay call when delay is a number', () => {
      const result = generate({ mock: { delay: 100 } });
      expect(result.implementation.handler).toContain('await delay(100);');
    });

    it('should not include delay call when delay is false', () => {
      const result = generate({ mock: { delay: false } });
      expect(result.implementation.handler).not.toContain('await delay');
    });

    it('should execute delay function immediately when delayFunctionLazyExecute is false', () => {
      const result = generate({
        mock: { delay: () => 200, delayFunctionLazyExecute: false },
      });
      expect(result.implementation.handler).toContain('await delay(200);');
    });

    it('should preserve delay function when delayFunctionLazyExecute is true', () => {
      const result = generate({
        mock: {
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
        mock: { delay: 100 },
        override: { ...baseOptions.override, mock: { delay: 500 } },
      });
      expect(result.implementation.handler).toContain('await delay(500);');
      expect(result.implementation.handler).not.toContain('await delay(100);');
    });

    it('should prioritize override.mock.delayFunctionLazyExecute', () => {
      const result = generate({
        mock: { delay: () => 100, delayFunctionLazyExecute: false },
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
      const result = generate({ mock: { delay: 100 } });

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
