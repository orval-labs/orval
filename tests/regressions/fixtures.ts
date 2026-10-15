import {
  defineFixture,
  defineFixtures,
  type Fixture,
  type FixtureRoute,
  type FixtureRoutes,
  type FixtureSet,
  respond,
} from '../generated/mock/fixtures/tags-operations-split/index.fixtures';
import type {
  Error,
  Pet,
  PetWithTag,
} from '../generated/mock/fixtures/tags-operations-split/model';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const assertType = <T extends true>(value: T) => value;

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

// A fixture by route or by operation is the same type.
const owner = defineFixture('showPetWithOwner', { tag: 'good' });
const byRoute = defineFixture('GET /api/pets/:petId/owner', { tag: 'good' });
assertType<Equals<typeof owner, Fixture<'GET /api/pets/:petId/owner'>>>(true);
assertType<Equals<typeof byRoute, typeof owner>>(true);
assertType<Equals<typeof owner.operation, 'showPetWithOwner'>>(true);
assertType<Equals<typeof owner.method, 'GET'>>(true);
assertType<Equals<typeof owner.path, '/api/pets/:petId/owner'>>(true);

// Replies are the route's response when ok, its error otherwise.
const reply = owner.reply();
if (reply.ok) assertType<Equals<typeof reply.body, PetWithTag>>(true);
else assertType<Equals<typeof reply.body, Error>>(true);

// URLs take the spec's path and query params.
owner.url({ petId: '1' });
// @ts-expect-error the path param is required
owner.url();
// @ts-expect-error no `id` param
owner.url({ id: '1' });
// @ts-expect-error the route takes no query
owner.url({ petId: '1' }, { expand: 'true' });
const sorted = defineFixture('listPets', [], { query: { sort: 'name' } });
sorted.url({ sort: '-name', limit: '10' });
// @ts-expect-error not a sort
sorted.url({ sort: 'age' });
// @ts-expect-error not a sort
defineFixture('listPets', [], { query: { sort: 'age' } });

// @ts-expect-error not an operation in the spec
defineFixture('showKitten');
// @ts-expect-error tag is a string
defineFixture('showPetWithOwner', { tag: 1 });
// @ts-expect-error the error body must be an Error
defineFixture('showPetById', respond(404, { oops: true }));
defineFixture('showPetById', respond(404, { code: 404, message: 'gone' }));
defineFixture('deletePetById', respond(204));

// Sets are typed by their fixtures, and widen when extended.
const set = defineFixtures([owner, defineFixture('showPetById')]);
assertType<
  Equals<
    typeof set,
    FixtureSet<
      Fixture<'GET /api/pets/:petId/owner'> | Fixture<'GET /api/pets/:petId'>
    >
  >
>(true);
const fromMap = defineFixtures({
  showPetWithOwner: { tag: 'good' },
  'GET /api/pets/:petId': {},
});
assertType<Equals<typeof fromMap, typeof set>>(true);
const wider = set.extend([sorted]);
assertType<
  Equals<
    typeof wider,
    FixtureSet<
      | Fixture<'GET /api/pets/:petId/owner'>
      | Fixture<'GET /api/pets/:petId'>
      | Fixture<'GET /api/pets'>
    >
  >
>(true);
set.get('showPetById');
set.get('GET /api/pets/:petId/owner');
// @ts-expect-error not in the set
set.get('listPets');
const answer = set.reply({ method: 'GET', url: '/api/pets/1' });
if (answer?.route === 'GET /api/pets/:petId' && answer.ok) {
  assertType<Equals<typeof answer.body, Pet>>(true);
}
// Any typed set is a `FixtureSet`.
const anySet: FixtureSet = set;

defineFixtures({
  showPetWithOwner: {},
  // @ts-expect-error not a route in the spec, even next to a real one
  'GET /api/kittens': {},
});

export {
  anySet,
  byRoute,
  extended,
  fromMap,
  missingMethod,
  params,
  route,
  wider,
  wrongParams,
};
