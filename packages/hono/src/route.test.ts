import { describe, expect, it } from 'vitest';

import { getRoute } from './route';

describe('getRoute getter', () => {
  // Hono keeps original parameter names (no camelization) so route params
  // line up with the spec names used by validators and `c.req.param()`.
  it.each([
    ['/api/test', '/api/test'],
    ['/api/test/{id}', '/api/test/:id'],
    // A malformed spec path without a leading slash is normalized.
    ['api/test/{id}', '/api/test/:id'],
    // A `${...}` block in a spec path is never a param — it stays literal.
    ['/api/test/${id}/x', '/api/test/${id}/x'],
    ['/api/test/{path*}', '/api/test/:path'],
    ['/api/test/{user_id}', '/api/test/:user_id'],
    ['/api/test/{_id}', '/api/test/:_id'],
    ['/api/test/{scope.id}', '/api/test/:scope.id'],
    // A malformed empty `{}` stays literal instead of emitting a bare `:`.
    ['/api/test/{}/x', '/api/test/{}/x'],
    [
      '/api/v1/{scope.id}/items/{item.name}',
      '/api/v1/:scope.id/items/:item.name',
    ],
    ['/api/test/{locale}.js', '/api/test/:locale.js'],
    ['/api/test/i18n-{locale}.js', '/api/test/i18n-:locale.js'],
    ['/api/test/{param1}-{param2}.js', '/api/test/:param1-:param2.js'],
  ])('should process the route %s => %s', (input, expected) => {
    expect(getRoute(input)).toBe(expected);
  });
});
