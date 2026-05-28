import { describe, expect, it } from 'vitest';

import { getNullable, isNullableSchema, resolveMockOverride } from './value';

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

describe('resolveMockOverride', () => {
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
