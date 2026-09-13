import { describe, expect, it } from 'vite-plus/test';

import { assertSafeResponseStatusKey, getStatusCodeType } from './http-status';

/**
 * A response key reaches generated source in unquoted positions — a TypeScript
 * type (`status: <key>`) and, in the axios client, a runtime expression
 * (`response.status === <key>`). There is no quote to escape there, so a
 * non-numeric key becomes live code. GHSA-rw75-cc5p-q7c9, GHSA-4j53-7m38-656f.
 */
describe('assertSafeResponseStatusKey', () => {
  it.each(['200', '204', '404', '503', '100', '599'])(
    'accepts the exact status code %s',
    (key) => {
      expect(assertSafeResponseStatusKey(key)).toBe(key);
    },
  );

  it.each(['1XX', '2XX', '3XX', '4XX', '5XX', '2xx'])(
    'accepts the wildcard %s',
    (key) => {
      expect(assertSafeResponseStatusKey(key)).toBe(key);
    },
  );

  it.each([
    // The advisories' proof-of-concept payloads.
    "2 || (globalThis.__pwned = require('child_process').execSync('id').toString()) || false",
    'number }; require("fs").writeFileSync("/tmp/pwn", "x"); type _Ignore = { _z: number',
    '2,x:(0)',
    // Shapes that merely are not status codes.
    'default',
    'abc',
    '2000',
    '20X',
    '600',
    '099',
    '',
    'x-vendor',
  ])('refuses %s', (key) => {
    expect(() => assertSafeResponseStatusKey(key)).toThrow(/not a status code/);
  });

  it('names the offending key so the document can be fixed', () => {
    expect(() => assertSafeResponseStatusKey('2,x:(0)')).toThrow('"2,x:(0)"');
  });
});

describe('getStatusCodeType', () => {
  it('returns an exact status code unchanged', () => {
    expect(getStatusCodeType('200')).toBe('200');
  });

  it('maps a wildcard to its shared union type', () => {
    expect(getStatusCodeType('2XX')).toBe('HTTPStatusCode2xx');
  });

  it('excludes overlapping exact statuses from a wildcard', () => {
    expect(getStatusCodeType('2XX', ['200', '2XX'])).toBe(
      'Exclude<HTTPStatusCode2xx, 200>',
    );
  });

  it('refuses a key that is not a status code', () => {
    expect(() =>
      getStatusCodeType(
        'number }; globalThis.pwned = 1; type _ = { _z: number',
      ),
    ).toThrow(/not a status code/);
  });

  it('refuses an injected key even when a wildcard sibling is present', () => {
    expect(() => getStatusCodeType('2 || (globalThis.x = 1)', ['2XX'])).toThrow(
      /not a status code/,
    );
  });
});
