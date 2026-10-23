import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiSchemaObject } from '../types';
import { schemaRenamesKeys } from './property-renames';

// The Angular client parses a request body only when this returns false: a
// renamed Zod schema would send converted keys the server does not know.
describe('schemaRenamesKeys', () => {
  const contextWith = (
    schemas: Record<string, OpenApiSchemaObject> = {},
    namingConvention: { properties?: 'camelCase' } = {
      properties: 'camelCase',
    },
  ) =>
    createTestContextSpec({
      spec: { components: { schemas } },
      override: { namingConvention },
    });

  it('is false without a property convention', () => {
    const schema = { type: 'object', properties: { pet_name: {} } } as const;

    expect(schemaRenamesKeys(schema, contextWith({}, {}))).toBe(false);
  });

  it('is false when every key already matches the convention', () => {
    const schema = {
      type: 'object',
      properties: { petName: { type: 'string' }, tag: { type: 'string' } },
    } as const;

    expect(schemaRenamesKeys(schema, contextWith())).toBe(false);
  });

  it('is true for a key the convention renames', () => {
    const schema = { type: 'object', properties: { pet_name: {} } } as const;

    expect(schemaRenamesKeys(schema, contextWith())).toBe(true);
  });

  it('follows refs into nested objects', () => {
    const context = contextWith({
      Owner: { type: 'object', properties: { first_name: {} } },
    });
    const schema = {
      type: 'object',
      properties: { owner: { $ref: '#/components/schemas/Owner' } },
    } as const;

    expect(schemaRenamesKeys(schema, context)).toBe(true);
  });

  it('looks into array items and combinators', () => {
    const renamed = { type: 'object', properties: { pet_name: {} } } as const;

    expect(
      schemaRenamesKeys({ type: 'array', items: renamed }, contextWith()),
    ).toBe(true);
    expect(schemaRenamesKeys({ allOf: [renamed] }, contextWith())).toBe(true);
    expect(
      schemaRenamesKeys(
        { type: 'object', additionalProperties: renamed },
        contextWith(),
      ),
    ).toBe(true);
  });

  it('is false when the only renamable keys collide and keep their names', () => {
    const schema = {
      type: 'object',
      properties: { first_name: {}, firstName: {} },
    } as const;

    expect(schemaRenamesKeys(schema, contextWith())).toBe(false);
  });

  it('treats a ref it cannot resolve as renaming', () => {
    const schema = { $ref: '#/components/schemas/Missing' };

    expect(schemaRenamesKeys(schema, contextWith())).toBe(true);
  });

  it('stops at a ref cycle', () => {
    const context = contextWith({
      Node: {
        type: 'object',
        properties: { child: { $ref: '#/components/schemas/Node' } },
      },
    });

    expect(
      schemaRenamesKeys({ $ref: '#/components/schemas/Node' }, context),
    ).toBe(false);
  });
});
