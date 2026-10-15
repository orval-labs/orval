import { describe, expect, it } from 'vite-plus/test';

import {
  defineFixture,
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
      'GET /api/health': respond(
        503,
        { code: 503, message: 'down' },
        { 'retry-after': '1' },
      ),
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
      body: { code: 503, message: 'down' },
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

  it('ranks a literal ahead of a param at the first position they differ', () => {
    // Both routes have two literal segments; the param route is defined first.
    const set = defineFixtures(
      {},
      {
        untyped: {
          'GET /api/shelters/:id/details': { route: 'param first' },
          'GET /api/shelters/new/:section': { route: 'literal first' },
        },
      },
    );

    expect(resolveFixture(set, get('/api/shelters/new/details'))?.body).toEqual(
      {
        route: 'literal first',
      },
    );
    expect(resolveFixture(set, get('/api/shelters/1/details'))?.body).toEqual({
      route: 'param first',
    });
  });

  it('keeps a malformed percent-encoded segment as is', () => {
    const set = defineFixtures({
      'GET /api/pets/:petId': ({ params }) => ({ name: params.petId }),
    });

    expect(resolveFixture(set, get('/api/pets/%E0'))?.body).toMatchObject({
      name: '%E0',
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

describe('defineFixture', () => {
  const owner = defineFixture('showPetWithOwner', { tag: 'good' });

  it('couples a fixture to its endpoint, by route or operation', () => {
    expect(owner).toMatchObject({
      key: 'GET /api/pets/:petId/owner',
      route: 'GET /api/pets/:petId/owner',
      operation: 'showPetWithOwner',
      method: 'GET',
      path: '/api/pets/:petId/owner',
      query: {},
    });
    expect(defineFixture('GET /api/pets/:petId/owner').operation).toBe(
      'showPetWithOwner',
    );
  });

  it('builds URLs and matches requests', () => {
    const sorted = defineFixture('listPets', [], { query: { sort: 'name' } });

    expect(owner.url({ petId: '7' })).toBe('/api/pets/7/owner');
    expect(sorted.url({ limit: '5' })).toBe('/api/pets?sort=name&limit=5');
    expect(owner.pattern.test('/api/pets/7/owner?x=1')).toBe(true);
    expect(owner.pattern.test('/api/pets/7')).toBe(false);
    expect(owner.matches(get('https://x.test/api/pets/7/owner'))).toBe(true);
    expect(owner.matches({ method: 'POST', url: '/api/pets/7/owner' })).toBe(
      false,
    );
    expect(sorted.matches(get('/api/pets?sort=name'))).toBe(true);
    expect(sorted.matches(get('/api/pets'))).toBe(false);
  });

  it('replies with the seeded mock, the fixture deep-merged on top', () => {
    const reply = owner.reply({ params: { petId: '7' } });

    expect(reply).toMatchObject({
      ok: true,
      status: 200,
      body: { tag: 'good' },
    });
    expect(reply.body).toHaveProperty('pet');
    expect(owner.reply()).toEqual(reply);
    expect(owner.reply({ url: '/api/pets/7/owner' })).toEqual(reply);
    expect(() => owner.reply({ url: '/api/pets/7' })).toThrow("doesn't match");
  });

  it('passes params and body to handlers, and answers respond() exactly', () => {
    expect(
      defineFixture('createPets', ({ body }) => ({ name: body?.name })).reply({
        body: { name: 'Rex', tag: 'dog' },
      }).body,
    ).toMatchObject({ name: 'Rex' });
    expect(
      defineFixture('showPetById', ({ params }) =>
        respond(404, { code: 404, message: `No pet ${params.petId}` }),
      ).reply({ params: { petId: '3' } }),
    ).toEqual({
      ok: false,
      status: 404,
      body: { code: 404, message: 'No pet 3' },
    });
    expect(defineFixture('deletePetById', respond(204)).reply()).toEqual({
      ok: true,
      status: 204,
      body: undefined,
    });
  });

  it('derives variants with deep merging', () => {
    const base = defineFixture('showPetWithOwner', { tag: 'base', pet: null });

    expect(base.with({ tag: 'variant' }).value).toEqual({
      tag: 'variant',
      pet: null,
    });
    expect(base.value).toEqual({ tag: 'base', pet: null });
  });
});

describe('fixture sets', () => {
  const owner = defineFixture('showPetWithOwner', { tag: 'good' });
  const sorted = defineFixture('listPets', [], { query: { sort: 'name' } });
  const set = defineFixtures([owner, sorted, defineFixture('listPets')]);

  it('keys fixtures like the map form, so both compose', () => {
    expect(Object.keys(set.fixtures)).toEqual([
      'GET /api/pets/:petId/owner',
      'GET /api/pets?sort=name',
      'GET /api/pets',
    ]);
    expect(
      Object.keys(set.extend({ showPetById: { name: 'Rex' } }).fixtures),
    ).toContain('GET /api/pets/:petId');
  });

  it('iterates its typed fixtures, most specific first', () => {
    expect([...set].map(({ key }) => key)).toEqual([
      'GET /api/pets?sort=name',
      'GET /api/pets/:petId/owner',
      'GET /api/pets',
    ]);
    expect([
      ...set.extend({}, { untyped: { 'GET /api/legacy': {} } }),
    ]).toHaveLength(3);
  });

  it('answers from the most specific fixture, with the fixture that answered', () => {
    const answer = set.reply(get('/api/pets?sort=name'));

    expect(answer).toMatchObject({
      ok: true,
      route: 'GET /api/pets',
      key: 'GET /api/pets?sort=name',
      body: [],
    });
    expect(answer?.fixture.query).toEqual({ sort: 'name' });
    expect(set.reply(get('/api/pets'))?.key).toBe('GET /api/pets');
    expect(set.reply(get('/api/health'))).toBeUndefined();
  });

  it('gets fixtures by route or operation, with the set seed', () => {
    // Seeds 0 and 1 both give this mock a `null` pet.
    const seeded = set.extend([], { seed: 2 });

    expect(seeded.get('showPetWithOwner').reply()).toEqual(
      seeded.get('GET /api/pets/:petId/owner').reply(),
    );
    expect(seeded.get('showPetWithOwner').reply()).not.toEqual(owner.reply());
    expect(() => set.get('showPetById' as never)).toThrow('no fixture');
  });

  it('deep-merges fixtures of the same key when extended', () => {
    const extended = set.extend([owner.with({ pet: null })]);

    expect(extended.get('showPetWithOwner').value).toEqual({
      tag: 'good',
      pet: null,
    });
  });
});
