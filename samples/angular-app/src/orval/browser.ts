import { setupWorker } from 'msw/browser';
import { http, HttpResponse, RequestHandler } from 'msw';

import * as httpClientMocks from '../api/http-client/index.msw';
import * as httpClientCustomParamsMocks from '../api/http-client-custom-params/index.msw';
import * as httpResourceMocks from '../api/http-resource/index.msw';
import * as httpResourceZodMocks from '../api/http-resource-zod/index.msw';

const createValidPet = (id: number) => ({
  id,
  name: 'Fluffy',
  tag: 'cat',
  status: 'available' as const,
  requiredNullableString: null,
  optionalNullableString: null,
  phone: '+14155550123',
});

type DemoPet = ReturnType<typeof createValidPet>;

const createInvalidPet = (id: number) => ({
  id,
  name: 'Fluffy',
  tag: 'cat',
  status: 'available' as const,
  phone: 'not-a-phone-number',
});

const createPetCollection = (count = 6) =>
  Array.from({ length: count }, (_, index) => createValidPet(index + 1));

let demoPets: DemoPet[] = createPetCollection();
let nextPetId = demoPets.length + 1;

const createPersistentPet = (partial?: Partial<DemoPet>): DemoPet => ({
  id: nextPetId++,
  name: partial?.name ?? 'Fluffy',
  tag: partial?.tag ?? 'cat',
  status: partial?.status ?? 'available',
  requiredNullableString: partial?.requiredNullableString ?? null,
  optionalNullableString: partial?.optionalNullableString ?? null,
  phone: partial?.phone ?? '+14155550123',
});

const findDemoPet = (id: number) =>
  demoPets.find((pet) => pet.id === id) ?? createValidPet(id);

const createInvalidPetCollection = (count = 6) =>
  Array.from({ length: count }, (_, index) => createInvalidPet(index + 1));

const customSearchPetsHandler = http.get(
  '*/v:version/search',
  ({ request }) => {
    const url = new URL(request.url);
    const demoValidation = url.searchParams.get('demoValidation');
    const demoMode = url.searchParams.get('demoMode');

    if (
      demoValidation === '1' &&
      (demoMode === 'search' || demoMode === 'body')
    ) {
      return HttpResponse.json(createInvalidPetCollection(), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return HttpResponse.json(demoPets, {
      headers: { 'Content-Type': 'application/json' },
    });
  },
);

const customListPetsHandler = http.get('*/v:version/pets', ({ request }) => {
  const accept = request.headers.get('Accept') || 'application/json';

  if (accept.includes('xml')) {
    return HttpResponse.text(JSON.stringify(demoPets), {
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  return HttpResponse.json(demoPets, {
    headers: { 'Content-Type': 'application/json' },
  });
});

const customCreatePetsHandler = http.post(
  '*/v:version/pets',
  async ({ request }) => {
    const body = (await request.json()) as Partial<DemoPet>;
    const createdPet = createPersistentPet({
      name: body.name,
      tag: body.tag,
      status: body.status,
    });

    demoPets = [createdPet, ...demoPets];

    return new HttpResponse(null, {
      status: 201,
    });
  },
);

// TODO: This is a temporary override for showPetById to handle Accept header content negotiation.
// The MSW generator needs to be fixed to generate this logic automatically (see issue #2243).
const customShowPetByIdHandler = http.get(
  '*/v:version/pets/:petId',
  ({ request, params }) => {
    const accept = request.headers.get('Accept') || 'application/json';
    const petId = params['petId'];
    const url = new URL(request.url);
    const demoValidation = url.searchParams.get('demoValidation');
    const mockPet =
      demoValidation === '1'
        ? createInvalidPet(Number(petId))
        : findDemoPet(Number(petId));

    if (accept.includes('xml') || accept.includes('json')) {
      return HttpResponse.json(mockPet, {
        headers: { 'Content-Type': accept },
      });
    }
    return new HttpResponse(
      `Pet ${petId}: ${mockPet.name} the ${mockPet.tag ?? 'pet'}`,
      {
        headers: { 'Content-Type': 'text/plain' },
      },
    );
  },
);

const allMocks = {
  ...httpClientMocks,
  ...httpClientCustomParamsMocks,
  ...httpResourceMocks,
  ...httpResourceZodMocks,
};

const generatedHandlers = Object.entries(allMocks)
  .filter(
    ([name]) =>
      name !== 'getShowPetByIdMockHandler' &&
      name !== 'getSearchPetsMockHandler' &&
      name !== 'getListPetsMockHandler' &&
      name !== 'getCreatePetsMockHandler',
  )
  .flatMap(([, getMock]) => (getMock as () => RequestHandler[])());

const handlers = [
  customSearchPetsHandler,
  customListPetsHandler,
  customCreatePetsHandler,
  customShowPetByIdHandler,
  ...generatedHandlers,
];
const worker = setupWorker(...handlers);

export { worker };
