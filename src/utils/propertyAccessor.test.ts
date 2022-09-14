import { generatePropertyAccessor } from './propertyAccessor';

describe('generatePropertyAccessor', () => {
  [
    ['key', '.key'],
    ['KEY', '.KEY'],
    ['my-key', "['my-key']"],
    ['$key', '.$key'],
    ['key$_123', '.key$_123'],
    ['123key', "['123key']"],
    ['files[]', "['files[]']"],
  ].forEach(([input, expected]) => {
    it(`should transform ${input} to ${expected}`, () => {
      expect(generatePropertyAccessor(input)).toBe(expected);
    });
  });
});
