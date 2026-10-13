import { describe, expect, it } from 'vite-plus/test';

import {
  defineFixtures,
  respond,
  resolveFixture,
} from './generated/mock/fixtures/tags-operations-split/index.fixtures';

const get = (url: string) => ({ method: 'GET', url });

describe('generated fixtures', () => {
  it('answers a mocked route with its seeded mock, the fixture deep-merged on top', () => {
    const set = defineFixtures({
      'GET /api/pets/:petId/owner': { tag: 'good' },
    });
    const result = resolveFixture(set, get('https://x.test/api/pets/7/owner'));

    expect(result).toMatchObject({
      route: 'GET /api/pets/:petId/owner',
      status: 200,
      body: { tag: 'good' },
    });
    expect(result?.body).toHaveProperty('pet');
  });

  it('returns the same mock values on every call, and other values for another seed', () => {
    // `undefined` answers with the route's mock unchanged.
    const set = defineFixtures({ 'GET /api/pets': undefined });
    const first = resolveFixture(set, get('/api/pets'))?.body;

    expect(resolveFixture(set, get('/api/pets'))?.body).toEqual(first);
    expect(Array.isArray(first)).toBe(true);
    expect(
      resolveFixture(set.extend({}, { seed: 1 }), get('/api/pets'))?.body,
    ).not.toEqual(first);
    // Arrays replace the mock's.
    expect(
      resolveFixture(defineFixtures({ 'GET /api/pets': [] }), get('/api/pets'))
        ?.body,
    ).toEqual([]);
  });

  it('passes params and body to handlers', () => {
    const set = defineFixtures({
      'GET /api/pets/:petId': ({ params }) => ({ name: `Pet ${params.petId}` }),
      'POST /api/pets': ({ body }) => ({ name: body?.name }),
    });

    expect(resolveFixture(set, get('/api/pets/42'))?.body).toMatchObject({
      name: 'Pet 42',
    });
    expect(
      resolveFixture(set, {
        method: 'post',
        url: '/api/pets',
        body: { name: 'Rex', tag: 'dog' },
      })?.body,
    ).toMatchObject({ name: 'Rex' });
  });

  it('answers respond() exactly', () => {
    const set = defineFixtures({
      'DELETE /api/pets/:petId': respond(204),
      'GET /api/health': respond(503, 'down', { 'retry-after': '1' }),
    });

    expect(
      resolveFixture(set, { method: 'DELETE', url: '/api/pets/1' }),
    ).toEqual({
      route: 'DELETE /api/pets/:petId',
      status: 204,
      body: undefined,
    });
    expect(resolveFixture(set, get('/api/health'))).toEqual({
      route: 'GET /api/health',
      status: 503,
      body: 'down',
      headers: { 'retry-after': '1' },
    });
  });

  it('prefers literal segments and query constraints', () => {
    const set = defineFixtures(
      {
        'GET /api/pets/:petId': { name: 'param' },
        'GET /api/pets/:petId/owner?expand=true': { tag: 'expanded' },
        'GET /api/pets/:petId/owner': { tag: 'plain' },
      },
      { untyped: { 'GET /api/pets/mine': { name: 'literal' } } },
    );

    expect(resolveFixture(set, get('/api/pets/mine'))?.body).toEqual({
      name: 'literal',
    });
    expect(resolveFixture(set, get('/api/pets/1'))?.body).toMatchObject({
      name: 'param',
    });
    expect(
      resolveFixture(set, get('/api/pets/1/owner?expand=true'))?.body,
    ).toMatchObject({ tag: 'expanded' });
    expect(resolveFixture(set, get('/api/pets/1/owner'))?.body).toMatchObject({
      tag: 'plain',
    });
  });

  it('deep-merges extended bodies and replaces everything else', () => {
    const base = defineFixtures({
      'GET /api/pets/:petId/owner': { tag: 'base', pet: null },
      'GET /api/health': respond(503),
    });
    const extended = base.extend({
      'GET /api/pets/:petId/owner': { tag: 'extended' },
      'GET /api/health': 'ok',
    });

    expect(extended.fixtures['GET /api/pets/:petId/owner']).toEqual({
      tag: 'extended',
      pet: null,
    });
    expect(resolveFixture(extended, get('/api/health'))?.body).toBe('ok');
    expect(resolveFixture(base, get('/api/health'))?.status).toBe(503);
  });

  it('answers untyped routes as given and misses unknown ones', () => {
    const set = defineFixtures(
      {},
      { untyped: { 'GET /api/legacy/:id': { legacy: true } } },
    );

    expect(resolveFixture(set, get('/api/legacy/1'))).toEqual({
      route: 'GET /api/legacy/:id',
      status: 200,
      body: { legacy: true },
    });
    expect(resolveFixture(set, get('/api/pets'))).toBeUndefined();
    expect(
      resolveFixture(set, { method: 'POST', url: '/api/legacy/1' }),
    ).toBeUndefined();
  });
});
