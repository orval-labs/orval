import { describe, expect, it } from 'vitest';
import {
  type ZodValidationSchemaDefinitionInput,
  parseZodValidationSchemaDefinition,
} from '.';

const queryParams: ZodValidationSchemaDefinitionInput = {
  // limit = non-required integer schema (coerce-able)
  limit: {
    functions: [
      ['number', undefined],
      ['optional', undefined],
      ['null', undefined],
    ],
    consts: [],
  },

  // q = non-required string array schema (not coerce-able)
  q: {
    functions: [
      [
        'array',
        {
          functions: [['string', undefined]],
          consts: [],
        },
      ],
      ['optional', undefined],
    ],
    consts: [],
  },
};

describe('parseZodValidationSchemaDefinition', () => {
  describe('with `override.coerceTypes = false` (default)', () => {
    it('does not emit coerced zod property schemas', () => {
      const parseResult = parseZodValidationSchemaDefinition(queryParams);

      expect(parseResult.zod).toBe(
        'zod.object({\n  "limit": zod.number().optional().null(),\n  "q": zod.array(zod.string()).optional()\n})',
      );
    });
  });

  describe('with `override.coerceTypes = true`', () => {
    it('emits coerced zod property schemas', () => {
      const parseResult = parseZodValidationSchemaDefinition(queryParams, true);

      expect(parseResult.zod).toBe(
        'zod.object({\n  "limit": zod.coerce.number().optional().null(),\n  "q": zod.array(zod.coerce.string()).optional()\n})',
      );
    });
  });
});
