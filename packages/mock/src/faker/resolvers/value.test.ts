import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import type { MockSchema } from '../../types';
import {
  getNullable,
  isNullableSchema,
  resolveMockOverride,
  resolveMockValue,
  resolveRefTarget,
} from './value';

type Item = OpenApiSchemaObject & { name: string; path?: string };

describe('isNullableSchema', () => {
  it('detects OpenAPI 3.0 nullable', () => {
    expect(isNullableSchema({ type: 'string', nullable: true })).toBe(true);
  });

  it('detects OpenAPI 3.1 null type unions', () => {
    expect(isNullableSchema({ type: ['string', 'null'] })).toBe(true);
  });

  it('returns false for non-nullable schemas', () => {
    expect(isNullableSchema({ type: 'string' })).toBe(false);
  });
});

describe('resolveRefTarget', () => {
  const context = createTestContextSpec({
    spec: {
      components: {
        schemas: { Pet: { type: 'object', required: ['name'] } },
      },
    },
  });

  it('resolves a same-document fragment ref', () => {
    expect(resolveRefTarget('#/components/schemas/Pet', context)).toEqual({
      type: 'object',
      required: ['name'],
    });
  });

  it('returns undefined for a fragmentless external ref', () => {
    expect(resolveRefTarget('./pet.yaml', context)).toBeUndefined();
  });
});

describe('resolveMockOverride (nonNullable)', () => {
  it('forwards nonNullableOption to getNullable for nullable overrides', () => {
    const result = resolveMockOverride(
      { tag: 'faker.string.uuid()' },
      { name: 'tag', type: ['string', 'null'] },
      true,
    );

    expect(result?.value).toBe('faker.string.uuid()');
    expect(result?.overrided).toBe(true);
  });

  it('wraps nullable overrides with null when nonNullableOption is false', () => {
    const result = resolveMockOverride(
      { tag: 'faker.string.uuid()' },
      { name: 'tag', type: ['string', 'null'] },
    );

    expect(result?.value).toBe(
      'faker.helpers.arrayElement([faker.string.uuid(), null])',
    );
  });
});

describe('getNullable', () => {
  it('wraps nullable values by default', () => {
    expect(getNullable('faker.string.uuid()', true)).toBe(
      'faker.helpers.arrayElement([faker.string.uuid(), null])',
    );
  });

  it('returns the value unchanged when nonNullableOption is true', () => {
    expect(getNullable('faker.string.uuid()', true, true)).toBe(
      'faker.string.uuid()',
    );
  });

  it('returns the value unchanged when nullable is false', () => {
    expect(getNullable('faker.string.uuid()', false, true)).toBe(
      'faker.string.uuid()',
    );
  });
});

describe('resolveMockOverride (#2465 — bare-key matching across array boundaries)', () => {
  const properties = {
    firstName: '() => faker.person.firstName()',
  };

  it('matches a top-level bare-key override (sanity check)', () => {
    const item: Item = { name: 'firstName', path: '#.firstName' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('matches a bare-key override when the property lives inside an array (#2465)', () => {
    // Path produced by the array recursion in getMockScalar when descending
    // into items: `#.[].firstName`. Before the fix this would not match the
    // bare `firstName` key and the user override would be silently dropped.
    const item: Item = { name: 'firstName', path: '#.[].firstName' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('matches a bare-key override for items inside a nested array (deep array case)', () => {
    const item: Item = { name: 'firstName', path: '#.users.[].firstName' };

    const result = resolveMockOverride(
      { 'users.firstName': '() => faker.person.firstName()' },
      item,
    );

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('treats `users.[].firstName` and `users.firstName` keys as equivalent (defensive symmetry)', () => {
    const item: Item = { name: 'firstName', path: '#.users.[].firstName' };

    const result = resolveMockOverride(
      { 'users.[].firstName': '() => faker.person.firstName()' },
      item,
    );

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('matches a key with a leading `[].` segment (operation-level array-items syntax)', () => {
    // The vue-query-basic sample uses `properties: { '[].id': ... }` at the
    // operation level to target the `id` of items returned by an
    // array-of-objects endpoint. Path arriving here is `#.[].id`.
    const item: Item = { name: 'id', path: '#.[].id' };

    const result = resolveMockOverride(
      { '[].id': '() => faker.number.int({ min: 1, max: 99999 })' },
      item,
    );

    expect(result?.value).toBe(
      '() => faker.number.int({ min: 1, max: 99999 })',
    );
  });

  it('matches bare keys against non-array nested paths (#3470)', () => {
    // The non-array nested case (`#.user.firstName` produced by an object
    // property `user` containing baseUser) is now transparent too, mirroring
    // the array transparency added in #2465. A bare `firstName` key applies
    // wherever the property literally appears, at any nesting depth.
    const item: Item = { name: 'firstName', path: '#.user.firstName' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('regex keys still match item.name regardless of array markers in the path', () => {
    const item: Item = { name: 'firstName', path: '#.[].firstName' };

    const result = resolveMockOverride(
      { '/^firstName$/': '() => faker.person.firstName()' },
      item,
    );

    expect(result?.value).toBe('() => faker.person.firstName()');
  });

  it('returns undefined for a non-matching bare key', () => {
    const item: Item = { name: 'lastName', path: '#.[].lastName' };

    const result = resolveMockOverride(properties, item);

    expect(result).toBeUndefined();
  });
});

describe('resolveMockOverride (#3470 — nested transparency precedence)', () => {
  // A bare key and an explicit dotted-path key both target `name`. The
  // dotted-path key is more specific, so it must win for its own path while
  // the bare key covers every other occurrence (most-specific-wins).
  const properties = {
    name: "'bare'",
    'country.name': "'France'",
  };

  it('prefers the explicit dotted-path key for its target path', () => {
    const item: Item = { name: 'name', path: '#.country.name' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe("'France'");
  });

  it('falls back to the bare key for other nested occurrences', () => {
    const item: Item = { name: 'name', path: '#.user.name' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe("'bare'");
  });

  it('keeps the bare key matching the top level', () => {
    const item: Item = { name: 'name', path: '#.name' };

    const result = resolveMockOverride(properties, item);

    expect(result?.value).toBe("'bare'");
  });

  it('does not let a dotted key match a leaf at the wrong path (stays anchored)', () => {
    // `country.name` is a root-anchored path, not a depth-independent name
    // match. It must not bleed onto `#.address.country.name`.
    const item: Item = { name: 'name', path: '#.address.country.name' };

    const result = resolveMockOverride({ 'country.name': "'France'" }, item);

    expect(result).toBeUndefined();
  });
});

describe('misplaced boolean `required` (#3719)', () => {
  const context = createTestContextSpec({
    spec: {
      components: {
        schemas: {
          Item: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
        },
      },
    },
  });

  const resolve = (schema: unknown) =>
    resolveMockValue({
      schema: schema as MockSchema,
      operationId: 'listItems',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

  it('names the offending schema instead of failing on the spread', () => {
    // A property that is a `$ref` with a sibling `required: true` used to reach
    // the spread in `resolveMockValue` and fail with
    // `(schemaReference.required ?? []) is not iterable`, which names neither
    // the schema nor the expected shape. The same document generates fine with
    // `mock: false`.
    expect(() =>
      resolve({ $ref: '#/components/schemas/Item', required: true }),
    ).toThrowError(/schema "Item" has `required: true`/);
  });

  it('still resolves a valid required array on the reference', () => {
    expect(() =>
      resolve({ $ref: '#/components/schemas/Item', required: ['name'] }),
    ).not.toThrow();
  });
});
