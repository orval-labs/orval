import { describe, expect, it } from 'vitest';
import { pascal } from './case';
import { kebab } from './case';

describe('pascal case testing', () => {
  it('should convert to pascal case', () => {
    expect(pascal('PascalCase')).toBe('PascalCase');
    expect(pascal('camelCase')).toBe('CamelCase');
    expect(pascal('kebab-case')).toBe('KebabCase');
    expect(pascal('snake_case')).toBe('SnakeCase');
    expect(pascal('point.case')).toBe('PointCase');
    expect(pascal('UPPER_CASE')).toBe('UpperCase');
    expect(pascal('DrUn-k_CaSE')).toBe('DrUnKCaSE');
  });

  it('should convert to pascal case with underscore', () => {
    expect(pascal('_camelCase')).toBe('_CamelCase');
    expect(pascal('_kebab-case')).toBe('_KebabCase');
  });

  it('should convert to pascal case when more complex input is given', () => {
    expect(pascal('camelCase_')).toBe('CamelCase');
    expect(pascal('more complex input')).toBe('MoreComplexInput');
  });

  it('should handle some casing edge cases', () => {
    expect(pascal('foo_bar_API')).toBe('FooBarAPI');
  });
});

describe('kebab-case a few examples', () => {
    //fix #937, issue #936, results in kebab routine being potentially called
    //on a string **repeatedly**.
    //Do some basic kebab case checks
    //Additionally, test that the kebab routine is Idempotent
    [
        ['Pet', 'pet'],
        ['pet', 'pet'],
        ['PetTag', 'pet-tag'],
        ['pet-tag', 'pet-tag'],
        ['PetTagWithFourWords', 'pet-tag-with-four-words'],
        ['pet-tag-with-four-words', 'pet-tag-with-four-words'],
    ].forEach(([input, expected]) => {
        it(`should process ${input} to ${expected}`, () => {
            expect(kebab(input)).toBe(expected);
        });
    });
});
