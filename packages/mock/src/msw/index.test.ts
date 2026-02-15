import { readFileSync } from 'node:fs';

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
      // Mock function signature should use ArrayBuffer instead of Blob
      expect(result.implementation.handler).not.toContain(
        'overrideResponse?: Blob',
      );
      expect(result.implementation.handler).toContain(
        'HttpResponse.arrayBuffer',
      );
      // The mock function should return an ArrayBuffer
      expect(result.implementation.function).toContain('ArrayBuffer');
      expect(result.implementation.function).not.toContain('Blob');
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

    it('should handle font content types as binary', () => {
      const fontVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: {
            success: [{ key: '200', value: 'Blob' }],
          },
          contentTypes: ['font/woff2'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(fontVerbOptions, baseOptions);

      expect(result.implementation.handler).not.toContain('JSON.stringify');
      expect(result.implementation.handler).toContain('font/woff2');
      expect(result.implementation.handler).toContain(
        'HttpResponse.arrayBuffer',
      );
    });

    it('should handle application/pdf as binary', () => {
      const pdfVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: {
            success: [{ key: '200', value: 'Blob' }],
          },
          contentTypes: ['application/pdf'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(pdfVerbOptions, baseOptions);

      expect(result.implementation.handler).not.toContain('JSON.stringify');
      expect(result.implementation.handler).toContain('application/pdf');
      expect(result.implementation.handler).toContain(
        'HttpResponse.arrayBuffer',
      );
    });

    it('should type the info parameter in the handler callback', () => {
      const result = generate({
        mock: { type: OutputMockType.MSW, delay: 100 },
      });

      // The handler callback's info param should be explicitly typed
      expect(result.implementation.handler).toContain(
        'async (info: Parameters<Parameters<typeof http.get>[1]>[0])',
      );
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

    it('should use HttpResponse.html for text/html responses', () => {
      const htmlVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/html'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(htmlVerbOptions, baseOptions);

      expect(result.implementation.handler).toContain('HttpResponse.html');
      expect(result.implementation.handler).not.toContain('HttpResponse.json');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
    });

    it('should use HttpResponse.xml for application/xml responses', () => {
      const xmlVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['application/xml'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(xmlVerbOptions, baseOptions);

      expect(result.implementation.handler).toContain('HttpResponse.xml');
      expect(result.implementation.handler).not.toContain('HttpResponse.json');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
    });

    it('should use HttpResponse.xml for vendor +xml responses', () => {
      const vendorXmlVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['application/vnd.api+xml'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(vendorXmlVerbOptions, baseOptions);

      expect(result.implementation.handler).toContain('HttpResponse.xml');
      expect(result.implementation.handler).not.toContain('HttpResponse.json');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
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

    it('should evaluate text response override expression once via temp variable', () => {
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

      // The handler should assign the resolved response to a temp var
      // and then use it, rather than inlining the await expression multiple times
      expect(result.implementation.handler).toContain('const resolvedBody =');
      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
    });

    it('should handle binary responses with ArrayBuffer fallback', () => {
      const blobVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: { success: [{ key: '200', value: 'Blob' }] },
          contentTypes: ['application/octet-stream'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(blobVerbOptions, baseOptions);

      // Should use the mock function and fall back to empty ArrayBuffer
      expect(result.implementation.handler).toContain(
        'binaryBody instanceof ArrayBuffer',
      );
      expect(result.implementation.handler).toContain('new ArrayBuffer(0)');
      // The binary handler should call the mock function as fallback
      expect(result.implementation.handler).toContain(
        'getGetUserResponseMock()',
      );
    });

    it('should honor preferredContentType for binary content headers', () => {
      const blobVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: { success: [{ key: '200', value: 'Blob' }] },
          contentTypes: ['application/octet-stream', 'image/png'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(blobVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'image/png',
        },
      });

      expect(result.implementation.handler).toContain(
        "headers: { 'Content-Type': 'image/png' }",
      );
    });

    it('should use HttpResponse.text when text/plain comes before application/xml in mixed content types', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain', 'application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: {
              mock: {
                data: { id: 1, name: 'Milo' },
              },
            },
          },
        },
      });

      // text/plain is the first text-like content type, so HttpResponse.text should be used
      expect(result.implementation.handler).toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
    });

    it('should use HttpResponse.xml when application/xml comes first in mixed content types', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: {
              mock: {
                data: { id: 1, name: 'Milo' },
              },
            },
          },
        },
      });

      // application/xml is the first text-like content type
      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
    });

    it('should keep text helper for exact string return types even when preferredContentType is application/json', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'application/json',
        },
      });

      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
    });

    it('should prefer HttpResponse.json for structured return types when json and xml are both available', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Pet' },
          types: { success: [{ key: '200', value: 'Pet' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: {
              mock: {
                data: { id: 1, name: 'Milo' },
              },
            },
          },
        },
      });

      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('should honor preferredContentType for text helpers when multiple text types exist', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain', 'text/html'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'text/html',
        },
      });

      expect(result.implementation.handler).toContain('HttpResponse.html(');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
    });

    it('should use HttpResponse.json when application/json is the only content type (no text-like)', () => {
      const result = generate();

      // Default mockVerbOptions has application/json only
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('HttpResponse.html(');
    });

    it('should use text prelude (resolvedBody → textBody) for xml and html responses', () => {
      const xmlVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['application/xml'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(xmlVerbOptions, baseOptions);

      // XML responses should still use the text prelude for string conversion
      expect(result.implementation.handler).toContain('const resolvedBody =');
      expect(result.implementation.handler).toContain('textBody');
      expect(result.implementation.handler).toContain(
        'HttpResponse.xml(textBody',
      );
    });

    it('should accept RequestHandlerOptions in all handler types', () => {
      // JSON handler
      const jsonResult = generate();
      expect(jsonResult.implementation.handler).toContain(
        'options?: RequestHandlerOptions',
      );
      expect(jsonResult.implementation.handler).toContain('}, options)');

      // Text handler
      const textVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain'],
        },
      } as GeneratorVerbOptions;
      const textResult = generateMSW(textVerbOptions, baseOptions);
      expect(textResult.implementation.handler).toContain(
        'options?: RequestHandlerOptions',
      );
      expect(textResult.implementation.handler).toContain('}, options)');

      // Binary handler
      const blobVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Blob' },
          types: { success: [{ key: '200', value: 'Blob' }] },
          contentTypes: ['application/octet-stream'],
        },
      } as GeneratorVerbOptions;
      const blobResult = generateMSW(blobVerbOptions, baseOptions);
      expect(blobResult.implementation.handler).toContain(
        'options?: RequestHandlerOptions',
      );
      expect(blobResult.implementation.handler).toContain('}, options)');
    });
  });

  describe('mixed content-type runtime branching (issue #2950)', () => {
    it('Test A: should generate runtime branching for text/plain + xml + json with union return type string | Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['text/plain', 'application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      // Should generate runtime typeof check to branch on resolved value
      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      // String values should use HttpResponse.text (first text-like content type)
      expect(result.implementation.handler).toContain('HttpResponse.text(');
      // Object values should use HttpResponse.json
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      // Should NOT use JSON.stringify — objects go to .json(), strings go to .text()
      expect(result.implementation.handler).not.toContain('JSON.stringify');
      // Should resolve the body once into a temp variable
      expect(result.implementation.handler).toContain('const resolvedBody =');
      // Should NOT have the textBody prelude (that's only for static text branch)
      expect(result.implementation.handler).not.toContain('const textBody =');
    });

    it('Test B: should generate runtime branching for xml + json with union return type string | Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      // Should generate runtime typeof check
      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      // String values should use HttpResponse.xml (first text-like = application/xml)
      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      // Object values should use HttpResponse.json
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      // Should NOT use JSON.stringify
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('Test C: should NOT use runtime branching for xml + json with non-union return type Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'Pet' },
          types: { success: [{ key: '200', value: 'Pet' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      // shouldPreferJsonResponse is true (non-string return type + json available)
      // so it should use HttpResponse.json directly — no runtime branching needed
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
      // No runtime typeof check
      expect(result.implementation.handler).not.toContain(
        "typeof resolvedBody === 'string'",
      );
    });

    it('Test D: should NOT use runtime branching for text/plain only with return type string', () => {
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

      // Pure string return type with text/plain only → static text branch, no runtime branching
      expect(result.implementation.handler).toContain('HttpResponse.text(');
      expect(result.implementation.handler).toContain('textBody');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
      // No runtime content-type switch branch is used; static text prelude computes textBody
      expect(result.implementation.handler).toContain('const resolvedBody =');
      expect(result.implementation.handler).toContain('const textBody =');
    });

    it('Test E: should NOT use runtime branching for text/plain + json with return type string (not union)', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, baseOptions);

      // mockReturnType === 'string' → needsRuntimeContentTypeSwitch is false
      // hasStringReturnType is true, shouldPreferJsonResponse is false
      // Falls into static text branch
      expect(result.implementation.handler).toContain('HttpResponse.text(');
      expect(result.implementation.handler).toContain('textBody');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
      // Uses static textBody prelude, not runtime branching
      expect(result.implementation.handler).toContain('const textBody =');
    });

    it('Test E2: should keep text/plain helper when preferredContentType is json and return type is string', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string' },
          types: { success: [{ key: '200', value: 'string' }] },
          contentTypes: ['text/plain', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'application/json',
        },
      });

      expect(result.implementation.handler).toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
      expect(result.implementation.handler).toContain('const textBody =');
    });

    it('Test F: should NOT use runtime branching when preferredContentType is json with union return type', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['text/plain', 'application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'application/json',
        },
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      // preferredContentType narrows contentTypesByPreference to ['application/json']
      // isTextResponse becomes false, so falls into the json-only branch
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('HttpResponse.text(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
      // No runtime typeof check needed
      expect(result.implementation.handler).not.toContain(
        "typeof resolvedBody === 'string'",
      );
    });

    it('Test G: should generate runtime branching for text/html + json with union return type string | Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['text/html', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      expect(result.implementation.handler).toContain('HttpResponse.html(');
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('Test H: should generate runtime branching for vendor +xml + json with union return type string | Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['application/vnd.orval+xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('Test I: should still select first text-like helper even when json appears first in content types', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['application/json', 'application/xml'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('Test J: should use static text path when preferredContentType is text/plain for union return type', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: ['text/plain', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        mock: {
          type: OutputMockType.MSW,
          preferredContentType: 'text/plain',
        },
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      expect(result.implementation.handler).toContain('HttpResponse.text(');
      expect(result.implementation.handler).toContain('const textBody =');
      expect(result.implementation.handler).not.toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain(
        "typeof resolvedBody === 'string'\n      ? HttpResponse",
      );
    });

    it('Test K: should generate runtime branching for vendor +xml + vendor +json with union return type string | Pet', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'string | Pet' },
          types: { success: [{ key: '200', value: 'string | Pet' }] },
          contentTypes: [
            'application/vnd.orval+xml',
            'application/vnd.orval+json',
          ],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      expect(result.implementation.handler).toContain(
        "typeof resolvedBody === 'string'",
      );
      expect(result.implementation.handler).toContain('HttpResponse.xml(');
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('JSON.stringify');
    });

    it('Test L: should not treat type names containing "string" as string return types', () => {
      const mixedVerbOptions = {
        ...mockVerbOptions,
        response: {
          ...mockVerbOptions.response,
          definition: { success: 'StringPayload | Pet' },
          types: { success: [{ key: '200', value: 'StringPayload | Pet' }] },
          contentTypes: ['application/xml', 'application/json'],
        },
      } as GeneratorVerbOptions;

      const result = generateMSW(mixedVerbOptions, {
        ...baseOptions,
        override: {
          ...baseOptions.override,
          operations: {
            ...baseOptions.override.operations,
            getUser: { mock: { data: { id: 1, name: 'Milo' } } },
          },
        },
      });

      // Since StringPayload is not the primitive `string`, this should prefer JSON for structured data
      expect(result.implementation.handler).toContain('HttpResponse.json(');
      expect(result.implementation.handler).not.toContain('HttpResponse.xml(');
      expect(result.implementation.handler).not.toContain(
        "typeof resolvedBody === 'string'\n      ? HttpResponse",
      );
    });

    it('Test M: generated mixed-content union fixtures should keep object-only override typing', () => {
      const fixturePaths = [
        '../../../../tests/generated/mock/msw-mixed-content-union/endpoints.ts',
        '../../../../tests/generated/mock/msw-mixed-content-union-preferred-json/endpoints.ts',
        '../../../../tests/generated/mock/msw-mixed-content-union-vendor/endpoints.ts',
        '../../../../tests/generated/mock/msw-mixed-content-union-each-status/endpoints.ts',
      ];

      const expectedSignature =
        'overrideResponse: Partial<Extract<string | Pet, object>> = {}';
      const legacySignature = 'overrideResponse: Partial< string | Pet > = {}';

      for (const relativePath of fixturePaths) {
        const content = readFileSync(new URL(relativePath, import.meta.url), {
          encoding: 'utf8',
        });

        expect(content).toContain(expectedSignature);
        expect(content).not.toContain(legacySignature);
      }
    });
  });
});
