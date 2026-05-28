import { describe, expect, it } from 'vitest';

import { getNullable } from './value';

describe('getNullable', () => {
  it('wraps nullable values by default', () => {
    expect(getNullable('faker.string.uuid()', true)).toBe(
      'faker.helpers.arrayElement([faker.string.uuid(), null])',
    );
  });

  it('returns the value unchanged when nonNullable is true', () => {
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
