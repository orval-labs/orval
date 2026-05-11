import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import type { ContextSpec, OpenApiResponsesObject } from '../types';
import { getResponse } from './response';

const context: ContextSpec = createTestContextSpec({
  target: 'spec',
  spec: {
    components: {
      schemas: {
        CreateSubscriptionResponseDto: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        BaseError: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        Pet: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  },
  override: {
    formData: { arrayHandling: 'serialize', disabled: false },
    enumGenerationType: 'const',
  },
});

describe('getResponse', () => {
  describe('multiple status codes with same schema', () => {
    it('should generate separate types for each status code when using custom uniqueKey function', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Existing subscription',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateSubscriptionResponseDto',
              },
            },
          },
        },
        '201': {
          description: 'New subscription created',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateSubscriptionResponseDto',
              },
            },
          },
        },
        '403': {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BaseError',
              },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BaseError',
              },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'configurationControllerCreateSubscription',
        context,
      });

      expect(result.types.success).toHaveLength(2);
      expect(result.types.errors).toHaveLength(2);

      const successKeys = result.types.success.map((type) => type.key);
      const errorKeys = result.types.errors.map((type) => type.key);

      expect(successKeys).toContain('200');
      expect(successKeys).toContain('201');
      expect(errorKeys).toContain('403');
      expect(errorKeys).toContain('404');

      expect(result.definition.success).toContain(
        'CreateSubscriptionResponseDto',
      );

      expect(result.definition.errors).toContain('BaseError');
    });

    it('should handle empty responses object', () => {
      const result = getResponse({
        responses: {},
        operationName: 'testOperation',
        context,
      });

      expect(result.definition.success).toBe('unknown');
      expect(result.definition.errors).toBe('unknown');
      expect(result.types.success).toHaveLength(0);
      expect(result.types.errors).toHaveLength(0);
    });

    // Removed: test for undefined responses was testing invalid usage
    // (responses parameter is typed as non-optional OpenApiResponsesObject)
  });

  describe('isBlob detection', () => {
    it.each([
      ['application/octet-stream'],
      ['application/pdf'],
      ['application/zip'],
    ])('should set isBlob to true for %s response', (binaryApplicationType) => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Binary file',
          content: {
            [binaryApplicationType]: {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'downloadFile',
        context,
      });

      expect(result.isBlob).toBe(true);
    });

    it('should set isBlob to true when success has both json and octet-stream responses', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Binary file',
          content: {
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        '400': {
          description: 'Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'downloadFileWithError',
        context,
      });

      expect(result.isBlob).toBe(true);
    });

    it('should set isBlob to false for application/json response', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'JSON response',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'getPet',
        context,
      });

      expect(result.isBlob).toBe(false);
    });

    it('should set isBlob to true for text/csv with format: binary schema', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'CSV binary file',
          content: {
            'text/csv': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'downloadCsv',
        context,
      });

      expect(result.isBlob).toBe(true);
    });

    it('should set isBlob to true for image content type', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Image file',
          content: {
            'image/png': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'getImage',
        context,
      });

      expect(result.isBlob).toBe(true);
    });
  });

  describe('duplicate union types', () => {
    it('should dedupe success types when multiple status codes reference the same schema', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Updated resource',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
          },
        },
        '201': {
          description: 'Created resource',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'createPets',
        context,
      });

      expect(result.definition.success).toBe('Pet');
    });

    it('should dedupe error types when multiple error codes reference the same schema', () => {
      const responses: OpenApiResponsesObject = {
        '200': {
          description: 'Success',
          content: {
            'application/json': { schema: { type: 'string' } },
          },
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        '404': {
          description: 'Not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      };

      const result = getResponse({
        responses,
        operationName: 'listPets',
        context,
      });

      expect(result.definition.errors).toBe('Error');
    });
  });
});
