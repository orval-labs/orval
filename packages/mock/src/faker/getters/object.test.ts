import type {
  ContextSpec,
  MockOptions,
  OpenApiSchemaObject,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import { getMockObject } from './object';

const petSchema = {
  name: 'Pet',
  type: 'object' as const,
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer', format: 'int64' },
    name: { type: 'string' },
    birthDate: {
      type: ['string', 'null'],
      format: 'date-time',
    },
    tag: { type: ['string', 'null'] },
    photoUrls: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
  },
};

describe('getMockObject', () => {
  const context: ContextSpec = createTestContextSpec();

  const getObjectMock = (
    item: Parameters<typeof getMockObject>[0]['item'],
    mockOptions?: MockOptions,
  ) =>
    getMockObject({
      item,
      operationId: 'getPetById',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      mockOptions,
    });

  it('generates object properties for nullable object type arrays (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
        },
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('generates object properties for nullable object with required fields (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
        },
        required: ['id'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.string.alpha(), name: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('returns empty object variant when nullable object has no properties (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe('faker.helpers.arrayElement([{}, null])');
  });

  it('does not emit null for nullable object schemas when nonNullable is true', () => {
    const result = getObjectMock(
      {
        name: 'nullableWidget',
        type: ['object', 'null'],
        properties: {
          id: { type: 'string' },
        },
      },
      { nonNullable: true },
    );

    expect(result.value).not.toContain('null');
    expect(result.value).toContain('id:');
  });

  it('wraps nullable object schemas with null when nonNullable is false', () => {
    const result = getObjectMock({
      name: 'nullableWidget',
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
      },
    });

    // A 3.1 type union is rendered by `combineSchemasMock` as an `anyOf`, so
    // the null arrives as its own branch of the union rather than as a
    // `getNullable` wrapper placed around the finished object.
    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
    expect(result.value).toMatch(/^faker\.helpers\.arrayElement\(\[\{/);
    // The branch reports the null it rendered, so a caller holding this value
    // -- the object property loop -- knows not to wrap it a second time. The
    // 3.0 path reports the same thing from `wrapRootNullableObjectValue`.
    expect(result.nullWrapped).toBe(true);
  });

  it('wraps nullable object schemas without properties at the root', () => {
    const result = getObjectMock({
      name: 'nullableWidget',
      type: ['object', 'null'],
    });

    expect(result.value).toBe('faker.helpers.arrayElement([{}, null])');
    // Same as above for the propertyless early return.
    expect(result.nullWrapped).toBe(true);
  });

  it('wraps optional nullable properties with null by default', () => {
    const result = getObjectMock(petSchema);

    expect(result.value).toContain(', null]');
    expect(result.value).toMatch(/birthDate: faker\.helpers\.arrayElement\(/);
    expect(result.value).toMatch(/tag: faker\.helpers\.arrayElement\(/);
  });

  it('does not emit null branches when nonNullable is true', () => {
    const result = getObjectMock(petSchema, {
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toMatch(
      /birthDate: faker\.helpers\.arrayElement\(\[faker\.date\.past\(\)/,
    );
    expect(result.value).toMatch(
      /tag: faker\.helpers\.arrayElement\(\[faker\.string\.alpha/,
    );
  });

  it('includes all keys with no null randomization when required and nonNullable are true', () => {
    const result = getObjectMock(petSchema, {
      required: true,
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('name:');
    expect(result.value).toContain('birthDate:');
    expect(result.value).toContain('tag:');
    expect(result.value).toContain('photoUrls:');
    expect(result.value).not.toMatch(
      /birthDate: faker\.helpers\.arrayElement\(\[[^,]+, undefined\]\)/,
    );
    expect(result.value).toMatch(/birthDate: faker\.date\.past\(\)/);
    expect(result.value).toMatch(/tag: faker\.string\.alpha/);
  });

  // An optional nullable property used to fall back to `undefined` through a
  // `hasNullable` check that only knew the 3.0 keyword, and since
  // `getMockScalar` had already wrapped the value for the type-union spelling,
  // the result nested one `arrayElement` inside another. (#4141)
  it('mocks an optional nullable field as a single null union', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        tag: { type: ['string', 'null'] },
      },
    });

    expect(result.value).toBe(
      '{tag: faker.helpers.arrayElement([faker.string.alpha(), null])}',
    );
  });

  it('does not double-wrap an optional OpenAPI 3.1 nullable field', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        tag: { type: ['string', 'null'] },
      },
    });

    expect(result.value).not.toMatch(
      /faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement/,
    );
  });

  // The type-union branches of `getMockObject` build their own `[..., null]`
  // union but returned no `nullWrapped`, so the `!resolvedValue.nullWrapped`
  // guard in the property loop could not see it and added a second wrapper.
  it('does not double-wrap a required OpenAPI 3.1 nullable object property', () => {
    const result = getObjectMock({
      name: 'Parent',
      type: 'object' as const,
      required: ['child'],
      properties: {
        child: {
          type: ['object', 'null'],
          properties: { id: { type: 'string' } },
        },
      },
    });

    expect(result.value).not.toMatch(
      /faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement/,
    );
    expect(result.value).toContain('null');
  });

  // A `{ type: 'null' }` branch of a `oneOf`/`anyOf` is the third 3.1 spelling
  // of nullability. `combineSchemasMock` renders it as a union member but did
  // not report `nullWrapped`, so the property loop wrapped it again.
  it('does not double-wrap an optional property nulled through anyOf', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        age: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      },
    });

    expect(result.value).not.toMatch(
      /faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement/,
    );
    expect(result.value).toContain('null');
  });

  it('does not double-wrap an optional property nulled through oneOf', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        address: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      },
    });

    expect(result.value).not.toMatch(
      /faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement/,
    );
  });

  it('still omits with undefined for an optional non-nullable field', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        tag: { type: 'string' },
      },
    });

    expect(result.value).toBe(
      '{tag: faker.helpers.arrayElement([faker.string.alpha(), undefined])}',
    );
  });

  // Under `exactOptionalPropertyTypes` a present key may not hold `undefined`,
  // so absence has to be expressed by leaving the key out (#3912).
  describe('exactOptional', () => {
    const optionalTag = (tag: OpenApiSchemaObject) => ({
      name: 'Pet',
      type: 'object' as const,
      properties: { tag },
    });

    it('omits an optional field by spreading it in conditionally', () => {
      const result = getObjectMock(optionalTag({ type: 'string' }), {
        exactOptional: true,
      });

      expect(result.value).toBe(
        '{...(faker.datatype.boolean() ? {tag: faker.string.alpha()} : {})}',
      );
    });

    it('quotes a key that is not a valid identifier', () => {
      const result = getObjectMock(
        {
          name: 'Pet',
          type: 'object' as const,
          properties: { 'pet-tag': { type: 'string' } },
        },
        { exactOptional: true },
      );

      expect(result.value).toBe(
        "{...(faker.datatype.boolean() ? {'pet-tag': faker.string.alpha()} : {})}",
      );
    });

    it('keeps null as the omission value for an optional nullable field', () => {
      const result = getObjectMock(optionalTag({ type: ['string', 'null'] }), {
        exactOptional: true,
      });

      expect(result.value).toBe(
        '{tag: faker.helpers.arrayElement([faker.string.alpha(), null])}',
      );
    });

    it('spreads an optional nullable field once nonNullable drops the null', () => {
      const result = getObjectMock(optionalTag({ type: ['string', 'null'] }), {
        exactOptional: true,
        nonNullable: true,
      });

      expect(result.value).toBe(
        '{...(faker.datatype.boolean() ? {tag: faker.string.alpha()} : {})}',
      );
    });

    it('leaves required fields as plain entries', () => {
      const result = getObjectMock(petSchema, { exactOptional: true });

      expect(result.value).toMatch(/^\{id: faker\.number\.int\(/);
      expect(result.value).toContain(', name: faker.string.alpha(');
      expect(result.value).not.toContain('undefined');
    });

    it('has nothing to spread when required is set', () => {
      const result = getObjectMock(optionalTag({ type: 'string' }), {
        exactOptional: true,
        required: true,
      });

      expect(result.value).toBe('{tag: faker.string.alpha()}');
    });
  });

  it('randomizes OpenAPI 3.1 nullable array items to null by default', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        names: {
          type: 'array',
          items: { type: ['string', 'null'] },
        },
      },
    });

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement\(\[faker\.string\.alpha\(\), null\]\)\)\)/,
    );
  });

  it('does not randomize OpenAPI 3.1 nullable array items to null when nonNullable is true', () => {
    const result = getObjectMock(
      {
        name: 'Pet',
        type: 'object' as const,
        properties: {
          names: {
            type: 'array',
            items: { type: ['string', 'null'] },
          },
        },
      },
      { nonNullable: true },
    );

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.string\.alpha\(\)\)\)/,
    );
    expect(result.value).not.toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement/,
    );
  });

  it('does not duplicate imports when resolving many delegated schema refs (#3590)', () => {
    const childSchemas = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `Child${i}`,
        {
          type: 'object',
          properties: { id: { type: 'integer' } },
        } satisfies OpenApiSchemaObject,
      ]),
    ) as Record<string, OpenApiSchemaObject>;
    const delegationContext: ContextSpec = createTestContextSpec({
      spec: {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: { schemas: childSchemas },
      },
      output: {
        mock: {
          indexMockFiles: false,
          inline: false,
          generators: [{ type: 'faker', schemas: true }],
        },
      },
      override: {
        mock: { required: true, nonNullable: true },
      },
    });

    const properties = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `prop${i}`,
        { $ref: `#/components/schemas/Child${i}` },
      ]),
    );

    expect(() =>
      getMockObject({
        item: {
          name: 'Parent',
          type: 'object',
          properties,
          required: ['prop0'],
        },
        operationId: 'Parent',
        tags: [],
        context: delegationContext,
        imports: [],
        existingReferencedProperties: ['Parent'],
        existingReferencedAllOfRefs: ['Parent'],
        splitMockImplementations: [],
        mockOptions: { required: true, nonNullable: true },
        allowOverride: true,
      }),
    ).not.toThrow();

    const result = getMockObject({
      item: {
        name: 'Parent',
        type: 'object',
        properties,
        required: ['prop0'],
      },
      operationId: 'Parent',
      tags: [],
      context: delegationContext,
      imports: [],
      existingReferencedProperties: ['Parent'],
      existingReferencedAllOfRefs: ['Parent'],
      splitMockImplementations: [],
      mockOptions: { required: true, nonNullable: true },
      allowOverride: true,
    });

    // Two imports per delegated ref (factory + strict mock type), not exponential.
    expect(result.imports.length).toBeLessThan(200);
  });
});

describe('getMockObject recursive reference terminators', () => {
  const nodeSchema = {
    type: 'object',
    required: ['next'],
    properties: { next: { $ref: '#/components/schemas/Node' } },
  } satisfies OpenApiSchemaObject;

  const buildNode = (
    schema: Exclude<OpenApiSchemaObject, boolean>,
    mockOptions?: MockOptions,
  ) => {
    const context = createTestContextSpec({
      spec: { components: { schemas: { Node: schema } } },
    });
    return getMockObject({
      item: {
        name: 'Node',
        ...schema,
      } as Parameters<typeof getMockObject>[0]['item'],
      operationId: 'Node',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: ['Node'],
      splitMockImplementations: [],
      mockOptions,
    });
  };

  it('casts a required non-nullable recursive $ref that cannot be stubbed', () => {
    const result = buildNode(nodeSchema);

    expect(result.value).toBe('{next: {} as unknown as Node}');
    expect(result.imports).toContainEqual(
      expect.objectContaining({ name: 'Node' }),
    );
  });

  it('keeps null when the recursive $ref targets a nullable schema', () => {
    const result = buildNode({
      ...nodeSchema,
      type: ['object', 'null'],
    });

    expect(result.value).toContain('next: null');
  });

  it('casts instead of null when nonNullable is set', () => {
    const result = buildNode(
      { ...nodeSchema, type: ['object', 'null'] },
      { nonNullable: true },
    );

    expect(result.value).not.toContain('next: null');
    expect(result.value).toContain('as unknown as Node');
  });

  it('omits an optional recursive $ref', () => {
    const result = buildNode({ ...nodeSchema, required: [] });

    expect(result.value).toBe('{}');
  });
});

// A value that is literally `null` already satisfies both "nullable" and
// "omitted", so wrapping it produced `arrayElement([null, null])` — a random
// choice between null and null. (#4141)
describe('getMockObject (degenerate null values)', () => {
  const context: ContextSpec = createTestContextSpec();

  it('does not randomize a property whose mock is already null', () => {
    const result = getMockObject({
      item: {
        name: 'Container',
        type: 'object' as const,
        properties: { timeStep: { type: 'null' } },
      },
      operationId: 'getContainer',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe('{timeStep: null}');
  });
});
