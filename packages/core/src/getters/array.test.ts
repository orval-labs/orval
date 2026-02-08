import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { getArray } from './array';

describe('getArray', () => {
  const context: ContextSpec = {
    output: {
      override: {
        components: {
          schemas: { suffix: '', itemSuffix: 'Item' },
        },
      },
    },
    target: 'typescript',
    spec: { openapi: '3.1.0' },
  };

  it('should inline types when name is undefined (no schemas generated)', () => {
    // When name is undefined, types should be inlined, not declared as schemas.
    // Previously `undefined + "Item"` became "undefinedItem" via JS coercion.
    const schema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [
        { type: 'string' },
        { type: 'object', properties: { id: { type: 'number' } } },
      ],
    };

    const result = getArray({
      schema,
      name: undefined,
      context,
    });

    // No schemas generated - types are inlined
    expect(result.schemas).toHaveLength(0);
  });

  it('should generate named schemas when name is provided', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [
        { type: 'string' },
        { type: 'object', properties: { id: { type: 'number' } } },
      ],
    };

    const result = getArray({
      schema,
      name: 'MyTuple',
      context,
    });

    expect(result.schemas).toHaveLength(1);
    expect(result.schemas[0].name).toBe('MyTupleItem1');
  });
});
