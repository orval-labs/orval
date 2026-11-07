import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiSchemaObject } from '../types';
import { getObject } from './object';

describe('getObject', () => {
  it('does not treat a boolean schema as a reference', () => {
    const context = createTestContextSpec({});

    expect(() =>
      getObject({
        item: true,
        name: 'Any',
        context,
        nullable: '',
      }),
    ).not.toThrow();
  });

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

  // https://github.com/orval-labs/orval/issues/4429
  describe('closed empty object', () => {
    const render = (item: OpenApiSchemaObject, nullable = '') =>
      getObject({
        item,
        name: 'ClosedEmpty',
        context: createTestContextSpec({ spec: {} }),
        nullable,
      }).value;

    it('renders additionalProperties: false with empty properties as a never index signature', () => {
      expect(
        render({
          type: 'object',
          properties: {},
          additionalProperties: false,
        }),
      ).toBe('{ [key: string]: never }');
    });

    it('renders additionalProperties: false with omitted properties as a never index signature', () => {
      expect(render({ type: 'object', additionalProperties: false })).toBe(
        '{ [key: string]: never }',
      );
    });

    it('renders unevaluatedProperties: false as a never index signature', () => {
      expect(render({ type: 'object', unevaluatedProperties: false })).toBe(
        '{ [key: string]: never }',
      );
    });

    it('keeps the permissive type when a conditional applicator can evaluate properties', () => {
      expect(
        render({
          type: 'object',
          unevaluatedProperties: false,
          if: { required: ['kind'] },
          else: { properties: { a: { type: 'string' } } },
        }),
      ).toBe('{ [key: string]: unknown }');
      expect(
        render({
          type: 'object',
          unevaluatedProperties: false,
          dependentSchemas: {
            a: { properties: { b: { type: 'string' } } },
          },
        }),
      ).toBe('{ [key: string]: unknown }');
    });

    it('treats an empty patternProperties map as closed', () => {
      expect(
        render({
          type: 'object',
          additionalProperties: false,
          patternProperties: {},
        }),
      ).toBe('{ [key: string]: never }');
    });

    it('ignores propertyNames and still emits a string never index signature', () => {
      expect(
        render({
          type: 'object',
          additionalProperties: false,
          propertyNames: { enum: ['allowed'] },
        }),
      ).toBe('{ [key: string]: never }');
    });

    it('keeps the nullable suffix', () => {
      expect(
        render({ type: 'object', additionalProperties: false }, ' | null'),
      ).toBe('{ [key: string]: never } | null');
    });

    it('keeps the permissive type for additionalProperties: true', () => {
      expect(
        render({
          type: 'object',
          properties: {},
          additionalProperties: true,
        }),
      ).toBe('{ [key: string]: unknown }');
    });

    it('keeps the permissive type for an unconstrained object', () => {
      expect(render({ type: 'object' })).toBe('{ [key: string]: unknown }');
    });

    it('keeps the permissive type when patternProperties allows keys', () => {
      expect(
        render({
          type: 'object',
          additionalProperties: false,
          patternProperties: { '^x-': { type: 'string' } },
        }),
      ).toBe('{ [key: string]: unknown }');
    });

    it('does not affect closed objects with declared properties', () => {
      const value = render({
        type: 'object',
        properties: { id: { type: 'string' } },
        additionalProperties: false,
      });
      expect(value).toContain('id?: string');
      expect(value).not.toContain('never');
    });

    it('does not intersect allOf siblings with a never index signature', () => {
      const value = getObject({
        item: {
          allOf: [
            { $ref: '#/components/schemas/Base' },
            { type: 'object', additionalProperties: false },
          ],
        },
        name: 'Extended',
        context: createTestContextSpec({
          spec: {
            components: {
              schemas: {
                Base: {
                  type: 'object',
                  properties: { a: { type: 'string' } },
                },
              },
            },
          },
        }),
        nullable: '',
      }).value;
      expect(value).toBe('Base & { [key: string]: unknown }');
    });

    it.each([
      ['unevaluatedProperties', 'allOf'],
      ['additionalProperties', 'allOf'],
      ['unevaluatedProperties', 'oneOf'],
    ] as const)(
      'does not intersect a closed empty %s parent with its %s members as never',
      (closedKey, separator) => {
        const value = getObject({
          item: {
            type: 'object',
            properties: {},
            [closedKey]: false,
            [separator]: [
              {
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
              },
            ],
          },
          name: 'Parent',
          context: createTestContextSpec({ spec: {} }),
          nullable: '',
        }).value;
        expect(value).toContain('a: string');
        expect(value).not.toContain('never');
      },
    );

    it('opens a referenced closed empty component inside allOf but keeps it closed standalone', () => {
      const context = createTestContextSpec({
        spec: {
          components: {
            schemas: {
              Base: {
                type: 'object',
                properties: { a: { type: 'string' } },
              },
              ClosedEmpty: { type: 'object', additionalProperties: false },
            },
          },
        },
      });
      const extended = getObject({
        item: {
          allOf: [
            { $ref: '#/components/schemas/Base' },
            { $ref: '#/components/schemas/ClosedEmpty' },
          ],
        },
        name: 'Extended',
        context,
        nullable: '',
      }).value;
      expect(extended).toBe('Base & { [key: string]: unknown }');

      const standalone = getObject({
        item: { type: 'object', additionalProperties: false },
        name: 'ClosedEmpty',
        context,
        nullable: '',
      }).value;
      expect(standalone).toBe('{ [key: string]: never }');
    });

    it('applies to oneOf members', () => {
      const value = getObject({
        item: {
          oneOf: [
            { type: 'object', additionalProperties: false },
            { type: 'string' },
          ],
        },
        name: 'Choice',
        context: createTestContextSpec({ spec: {} }),
        nullable: '',
      }).value;
      expect(value).toContain('{ [key: string]: never }');
    });
  });
});
