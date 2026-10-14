import {
  defineFixtures,
  type FixtureRoute,
  type FixtureRoutes,
  respond,
} from '../generated/mock/fixtures/tags-operations-split/index.fixtures';

// Bodies of mocked routes are deep partials of the response.
const pets = defineFixtures({
  'GET /api/pets/:petId/owner': { tag: 'good' },
  'GET /api/health': 'ok',
  'DELETE /api/pets/:petId': respond(204),
  // Handlers get the route's params and body.
  'GET /api/pets/:petId': ({ params }) => ({ name: `Pet ${params.petId}` }),
  'POST /api/pets': ({ body }) => ({ name: body?.name ?? 'new' }),
  // A query suffix keeps the route's types.
  'GET /api/pets/:petId/owner?expand=true': { tag: 'expanded' },
});

const extended = pets.extend(
  { 'GET /api/pets/:petId/owner': { pet: null } },
  { untyped: { 'GET /api/legacy/thing': { anything: true } }, seed: 1 },
);

defineFixtures({
  // @ts-expect-error not a route in the spec
  'GET /api/kittens': {},
});

defineFixtures({
  // @ts-expect-error tag is a string
  'GET /api/pets/:petId/owner': { tag: 1 },
});

defineFixtures({
  // @ts-expect-error no such field
  'GET /api/pets/:petId/owner': { colour: 'red' },
});

// Handler params are the route's params.
const params: FixtureRoutes['GET /api/pets/:petId']['params'] = { petId: '1' };
const wrongParams: FixtureRoutes['GET /api/pets/:petId']['params'] = {
  // @ts-expect-error the route has no `id` param
  id: '1',
};

const route: FixtureRoute = 'GET /api/pets';
// @ts-expect-error routes include the method
const missingMethod: FixtureRoute = '/api/pets';

export { extended, missingMethod, params, route, wrongParams };
