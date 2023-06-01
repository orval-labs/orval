import { describe, expect, it, test } from 'vitest';
import { getRoute, getRouteAsArray } from './route';

describe('getRoute getter', () => {
  [
    ['/api/test/{id}', '/api/test/${id}'],
    ['/api/test/{path*}', '/api/test/${path}'],
    ['/api/test/{user_id}', '/api/test/${userId}'],
    ['/api/test/{locale}.js', '/api/test/${locale}.js'],
    ['/api/test/i18n-{locale}.js', '/api/test/i18n-${locale}.js'],
    ['/api/test/{param1}-{param2}.js', '/api/test/${param1}-${param2}.js'],
    [
      '/api/test/user{param1}-{param2}.html',
      '/api/test/user${param1}-${param2}.html',
    ],
  ].forEach(([input, expected]) => {
    it(`should process ${input} to ${expected}`, () => {
      expect(getRoute(input)).toBe(expected);
    });
  });
});

describe('getRouteAsArray getter', () => {
  test.each([
    ['/v${version}/the/nope/${param}', "'v',version,'the','nope',param"],
    ['/${version}/the/${nope}/${param}', "version,'the',nope,param"],
    ['/the/${nope}', "'the',nope"],
    ['/the/nope', "'the','nope'"],
    ['the/nope', "'the','nope'"],
  ])('$1 evals to %2', (input, output) => {
    expect(getRouteAsArray(input)).toEqual(output);
  });
});
