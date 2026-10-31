import { describe, expect, it } from 'vite-plus/test';

import { gen } from './test-helpers';

describe('constraints', () => {
  it('maps string length and array size to minLength/maxLength', () => {
    const string = gen({ type: 'string', minLength: 2, maxLength: 3 });
    expect(string.ok('ab')).toBe(true);
    expect(string.ok('a')).toBe(false);
    expect(string.ok('abcd')).toBe(false);

    const array = gen({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 2,
    });
    expect(array.ok([])).toBe(false);
    expect(array.ok(['a', 'b', 'c'])).toBe(false);
  });

  it('uses v.minLength where code units and code points agree', () => {
    expect(gen({ type: 'string', minLength: 1 }).valibot).toContain(
      'v.minLength(1)',
    );
  });

  it('counts string length in code points', () => {
    const { ok } = gen({ type: 'string', minLength: 2, maxLength: 2 });
    expect(ok('\u{1F600}\u{1F600}')).toBe(true);
    expect(ok('\u{1F600}')).toBe(false);
    expect(ok('\u{1F600}\u{1F600}\u{1F600}')).toBe(false);
  });

  it('keeps a maxItems of 0', () => {
    const { ok } = gen({ type: 'array', items: {}, maxItems: 0 });
    expect(ok([])).toBe(true);
    expect(ok([1])).toBe(false);
  });

  it('maps numeric bounds, exclusive bounds and multipleOf', () => {
    const bounded = gen({ type: 'number', minimum: 0, maximum: 10 });
    expect(bounded.ok(0)).toBe(true);
    expect(bounded.ok(11)).toBe(false);

    const exclusive = gen({
      type: 'number',
      exclusiveMinimum: 0,
      exclusiveMaximum: 10,
    });
    expect(exclusive.ok(0)).toBe(false);
    expect(exclusive.ok(10)).toBe(false);
    expect(exclusive.ok(5)).toBe(true);

    expect(gen({ type: 'number', multipleOf: 5 }).ok(7)).toBe(false);
  });

  it('rejects a non-finite constraint instead of emitting it', () => {
    expect(() =>
      gen({ type: 'number', minimum: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() =>
      gen({ type: 'array', maxItems: 'x); evil(' as unknown as number }),
    ).toThrow();
  });

  it('uses a pattern as written, including slashes', () => {
    const { ok } = gen({ type: 'string', pattern: '/api/' });
    expect(ok('/api/')).toBe(true);
    expect(ok('api')).toBe(false);
  });

  it('adds the u flag only for unicode property escapes', () => {
    expect(gen({ type: 'string', pattern: '^[a-z]+$' }).valibot).not.toContain(
      "'u'",
    );
    const unicode = gen({ type: 'string', pattern: '^\\p{L}+$' });
    expect(unicode.valibot).toContain("'u'");
    expect(unicode.ok('\u{E9}')).toBe(true);
  });

  it('skips a pattern that is not a JavaScript RegExp', () => {
    const { valibot, ok } = gen({ type: 'string', pattern: '(?i)abc' });
    expect(valibot).toBe('v.string()');
    expect(ok('anything')).toBe(true);
  });

  it('escapes a pattern that contains a quote', () => {
    const { ok } = gen({ type: 'string', pattern: "^it's$" });
    expect(ok("it's")).toBe(true);
  });
});

describe('formats', () => {
  it('uses isoTimestamp for date-time, which accepts an offset', () => {
    const { ok } = gen({ type: 'string', format: 'date-time' });
    expect(ok('2024-01-01T10:00:00Z')).toBe(true);
    expect(ok('2024-01-01T10:00:00+02:00')).toBe(true);
    expect(ok('2024-01-01')).toBe(false);
  });

  it('validates date, email, uri and uuid', () => {
    expect(gen({ type: 'string', format: 'date' }).ok('2024-13-01')).toBe(
      false,
    );
    expect(gen({ type: 'string', format: 'email' }).ok('a@b.co')).toBe(true);
    expect(gen({ type: 'string', format: 'uri' }).ok('/relative')).toBe(false);
    expect(
      gen({ type: 'string', format: 'uuid' }).ok(
        '123e4567-e89b-12d3-a456-426614174000',
      ),
    ).toBe(true);
  });

  it('turns date and date-time into Date with useDates, after the checks', () => {
    const { valibot, output } = gen(
      { type: 'string', format: 'date-time', maxLength: 30, pattern: '^2024' },
      { useDates: true },
    );
    expect(output('2024-01-01T00:00:00Z')).toBeInstanceOf(Date);
    expect(valibot.indexOf('v.regex')).toBeLessThan(
      valibot.indexOf('v.transform'),
    );
  });

  it('accepts a File for binary and rejects a plain Blob', () => {
    const { ok } = gen({ type: 'string', format: 'binary' });
    expect(ok(new File(['x'], 'a.txt'))).toBe(true);
    expect(ok(new Blob(['x']))).toBe(false);
  });

  it('ignores an inherited property name as a format', () => {
    for (const format of ['constructor', '__proto__', 'toString']) {
      expect(gen({ type: 'string', format }).valibot).toBe('v.string()');
    }
  });

  describe('string length', () => {
    it('decides most values without splitting the string', () => {
      const { valibot } = gen({ type: 'string', minLength: 3, maxLength: 5 });
      expect(valibot).toContain('value.length >= 6 || [...value].length >= 3');
      expect(valibot).toContain(
        'value.length <= 5 || (value.length <= 10 && [...value].length <= 5)',
      );
    });

    it('rejects a huge string without splitting it', () => {
      const { ok } = gen({ type: 'string', minLength: 3, maxLength: 5 });
      const huge = 'a'.repeat(2 ** 26);
      const start = performance.now();
      expect(ok(huge)).toBe(false);
      // Splitting the string takes seconds and gigabytes.
      expect(performance.now() - start).toBeLessThan(1000);
    });

    it('names the expected length in the error', () => {
      const { valibot } = gen({ type: 'string', maxLength: 2 });
      expect(valibot).toContain("'Invalid length: Expected <=2'");
    });

    it('counts code points around the shortcuts', () => {
      const { ok } = gen({ type: 'string', minLength: 2, maxLength: 3 });
      expect(ok('ab')).toBe(true);
      expect(ok('a')).toBe(false);
      expect(ok('\u{1F600}a')).toBe(true);
      expect(ok('\u{1F600}\u{1F600}\u{1F600}')).toBe(true);
      expect(ok('\u{1F600}\u{1F600}\u{1F600}a')).toBe(false);
      expect(ok('\u{1F600}')).toBe(false);
    });
  });
});
