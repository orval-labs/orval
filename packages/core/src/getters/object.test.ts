import { describe, expect, it } from 'vitest';

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
});
