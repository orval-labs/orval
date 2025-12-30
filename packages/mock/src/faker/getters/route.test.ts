import { describe, expect, it } from 'vitest';

import { getRouteMSW } from './route';

describe('getRoute getter', () => {
  for (const [input, expected] of [
    ['/', '*/'],
    ['/api/test/{id}', '*/api/test/:id'],
    ['/api/test/{path*}', '*/api/test/:path'],
    ['/api/test/{user_id}', '*/api/test/:userId'],
    ['/api/test/{locale}.js', '*/api/test/:locale.js'],
    ['/api/test/i18n-{locale}.js', '*/api/test/i18n-:locale.js'],
    ['/api/test/{param1}-{param2}.js', '*/api/test/:param1-:param2.js'],
    [
      '/api/test/user{param1}-{param2}.html',
      '*/api/test/user:param1-:param2.html',
    ],
  ]) {
    it(`should process ${input} to ${expected}`, () => {
      expect(getRouteMSW(input)).toBe(expected);
    });
  }
});
