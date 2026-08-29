import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiSchemaObject } from '../types';
import { getObject } from './object';

describe('getObject', () => {
  it('suffixes inline object property schema names that collide with component schemas', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            UserDetails: { type: 'object' },
          },
        },
      },
    });

    const result = getObject({
      item: {
        type: 'object',
        properties: {
          details: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
      name: 'User',
      context,
      nullable: '',
    });

    expect(result.value).toContain('details?: UserDetailsProperty');
    expect(result.schemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'UserDetailsProperty' }),
      ]),
    );
  });

  it('uses the same PascalCase collision semantics for differently cased or separated schema names', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            'user-details': { type: 'object' },
            user_details: { type: 'object' },
          },
        },
      },
    });

    const result = getObject({
      item: {
        type: 'object',
        properties: {
          details: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
            },
          },
        },
      } satisfies OpenApiSchemaObject,
      name: 'User',
      context,
      nullable: '',
    });

    expect(result.value).toContain('details?: UserDetailsProperty');
    expect(result.schemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'UserDetailsProperty' }),
      ]),
    );
  });

  it('keeps inline object property schema names unchanged when component schemas do not collide', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            AccountDetails: { type: 'object' },
          },
        },
      },
    });

    const result = getObject({
      item: {
        type: 'object',
        properties: {
          details: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
      name: 'User',
      context,
      nullable: '',
    });

    expect(result.value).toContain('details?: UserDetails');
    expect(result.value).not.toContain('UserDetailsProperty');
    expect(result.schemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'UserDetails' }),
      ]),
    );
  });

  it('renders unevaluatedProperties as an index signature like additionalProperties', () => {
    const context = createTestContextSpec({ spec: {} });

    const result = getObject({
      item: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        unevaluatedProperties: { type: 'string', maxLength: 10 },
      },
      name: 'WithExtras',
      context,
      nullable: '',
    });

    // Falls back to unknown because named key types can't be proven equal
    // to the index value type without propertyNames constraint — same as
    // additionalProperties. See object.ts line 563–575.
    expect(result.value).toContain('[key: string]: unknown;');
  });

  it('renders unevaluatedProperties: true as unknown index signature', () => {
    const context = createTestContextSpec({ spec: {} });

    const result = getObject({
      item: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        unevaluatedProperties: true,
      },
      name: 'OpenObject',
      context,
      nullable: '',
    });

    expect(result.value).toContain('[key: string]: unknown;');
  });
});
