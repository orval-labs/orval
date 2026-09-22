import { describe, expect, it } from 'vite-plus/test';

import { camel, pascal } from './case';
import { kebab, snake } from './case';

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

  it('should handle empty values', () => {
    expect(pascal('')).toBe('');
    expect(pascal()).toBe('');
  });

  it('should handle nordic characters', () => {
    // norwegian
    expect(pascal('ærlig-ønske-åpen')).toBe('ÆrligØnskeÅpen');
    expect(pascal('ÆRLIG_ØNSKE_ÅPEN')).toBe('ÆrligØnskeÅpen');
    // swedish
    expect(pascal('ärlig-önske-öppen')).toBe('ÄrligÖnskeÖppen');
    expect(pascal('ÄRLIG_ÖNSKE_ÖPPEN')).toBe('ÄrligÖnskeÖppen');
    // danish
    expect(pascal('ærlig-ønske-åben')).toBe('ÆrligØnskeÅben');
    expect(pascal('ÆRLIG_ØNSKE_ÅBEN')).toBe('ÆrligØnskeÅben');
  });
});

describe('camel case testing', () => {
  it('should handle empty values', () => {
    expect(camel('')).toBe('');
    expect(camel()).toBe('');
  });
});

describe('kebab-case a few examples', () => {
  //fix #937, issue #936, results in kebab routine being potentially called
  //on a string **repeatedly**.
  //Do some basic kebab case checks
  //Additionally, test that the kebab routine is Idempotent
  for (const [input, expected] of [
    ['Pet', 'pet'],
    ['pet', 'pet'],
    ['PetTag', 'pet-tag'],
    ['pet-tag', 'pet-tag'],
    ['PetTagWithFourWords', 'pet-tag-with-four-words'],
    ['pet-tag-with-four-words', 'pet-tag-with-four-words'],
  ]) {
    it(`should process ${input} to ${expected}`, () => {
      expect(kebab(input)).toBe(expected);
    });
  }
});

describe('snake_case and kebab-case word splitting', () => {
  for (const [input, snakeExpected, kebabExpected] of [
    // acronyms are split out only when the input has no separators
    ['getHTTPResponse', 'get_http_response', 'get-http-response'],
    ['get-HTTPResponse', 'get_httpresponse', 'get-httpresponse'],
    ['HTTP_RESPONSE', 'http_response', 'http-response'],
    ["pet's tag", 'pets_tag', 'pets-tag'],
    [
      '  leading and trailing  ',
      '_leading_and_trailing',
      '-leading-and-trailing',
    ],
    ['', '', ''],
  ]) {
    it(`should process ${JSON.stringify(input)}`, () => {
      expect(snake(input)).toBe(snakeExpected);
      expect(kebab(input)).toBe(kebabExpected);
    });
  }
});

describe('property names inherited from Object.prototype', () => {
  // A schema is free to name a property `toString` or `constructor`. The
  // pascal cache is keyed by that name, so on an object literal the lookup
  // read the inherited member back instead of a cached string.
  for (const name of [
    'toString',
    'valueOf',
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'toLocaleString',
    'propertyIsEnumerable',
  ]) {
    it(`pascal('${name}') returns a string`, () => {
      const result = pascal(name);
      expect(typeof result).toBe('string');
      expect(result).toBe(name.charAt(0).toUpperCase() + name.slice(1));
    });

    it(`camel('${name}') returns a string`, () => {
      expect(camel(name)).toBe(name);
    });
  }

  it('shapes __proto__ by the same word rules as any other name', () => {
    expect(pascal('__proto__')).toBe('_Proto');
    expect(camel('__proto__')).toBe('_proto');
  });

  it('returns the same value on a second call', () => {
    expect(pascal('toString')).toBe(pascal('toString'));
    expect(pascal('petTag')).toBe('PetTag');
    expect(pascal('petTag')).toBe('PetTag');
  });
});
