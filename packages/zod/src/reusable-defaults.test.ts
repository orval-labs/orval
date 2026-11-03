import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import {
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
} from './index';

describe('defaults on reusable schema references', () => {
  it.each([false, true])(
    'keeps tuple defaults contextually typed (Zod 4: %s)',
    (isZodV4) => {
      const context = createTestContextSpec({
        spec: {
          components: {
            schemas: {
              ParameterRange: {
                type: 'array',
                prefixItems: [{ type: 'integer' }, { type: 'integer' }],
              },
            },
          },
        },
      });
      const definition = generateZodValidationSchemaDefinition(
        {
          $ref: '#/components/schemas/ParameterRange',
          default: [1, 300],
        },
        context,
        'exampleRange',
        false,
        isZodV4,
        { useReusableSchemas: true },
      );
      const result = parseZodValidationSchemaDefinition(
        definition,
        context,
        false,
        false,
        isZodV4,
      );
      expect(result.zod).toContain('.default([1, 300])');
      expect(result.consts).not.toContain('exampleRangeDefault');
    },
  );

  it.each([false, true])(
    'keeps enum properties in object defaults contextually typed (Zod 4: %s)',
    (isZodV4) => {
      const context = createTestContextSpec({
        spec: {
          components: {
            schemas: {
              Parameters: {
                type: 'object',
                properties: {
                  method: { type: 'string', enum: ['option_a', 'option_b'] },
                },
              },
            },
          },
        },
      });
      const definition = generateZodValidationSchemaDefinition(
        {
          $ref: '#/components/schemas/Parameters',
          default: { method: 'option_a' },
        },
        context,
        'exampleParameters',
        false,
        isZodV4,
        { useReusableSchemas: true },
      );
      const result = parseZodValidationSchemaDefinition(
        definition,
        context,
        false,
        false,
        isZodV4,
      );
      expect(result.zod).toContain(".default({ method: 'option_a', })");
      expect(result.consts).not.toContain('exampleParametersDefault');
    },
  );
});
