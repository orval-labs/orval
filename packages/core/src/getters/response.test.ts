import { describe, it, expect } from 'vitest';
import { ResponsesObject } from 'openapi3-ts/oas30';
import { getResponse } from './response';

const context = {
  output: {
    override: {
      formData: { arrayHandling: 'serialize', disabled: false },
      enumGenerationType: 'const',
    },
  },
  specKey: 'spec',
  target: 'spec',
  workspace: '',
  specs: {
    spec: {
      components: { schemas: {} },
    },
  },
};

describe('getResponse', () => {
  describe('multiple status codes with same schema', () => {
    it('should generate separate types for each status code when using custom uniqueKey function', () => {
      const responses: ResponsesObject = {
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
        context: context as any,
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
        context: context as any,
      });

      expect(result.definition.success).toBe('unknown');
      expect(result.definition.errors).toBe('unknown');
      expect(result.types.success).toHaveLength(0);
      expect(result.types.errors).toHaveLength(0);
    });

    it('should handle undefined responses', () => {
      const result = getResponse({
        responses: undefined as any,
        operationName: 'testOperation',
        context: context as any,
      });

      expect(result.definition.success).toBe('');
      expect(result.definition.errors).toBe('');
      expect(result.types.success).toHaveLength(0);
      expect(result.types.errors).toHaveLength(0);
    });
  });
});
