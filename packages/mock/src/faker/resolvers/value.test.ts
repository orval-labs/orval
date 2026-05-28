import { describe, expect, it } from 'vitest';

import { getNullable, isNullableSchema } from './value';

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

describe('getNullable', () => {
  it('wraps nullable values by default', () => {
    expect(getNullable('faker.string.uuid()', true)).toBe(
      'faker.helpers.arrayElement([faker.string.uuid(), null])',
    );
  });

  it('returns the value unchanged when skipNull is true', () => {
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
