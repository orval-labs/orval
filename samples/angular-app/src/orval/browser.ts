import { setupWorker } from 'msw/browser';
import { http, HttpResponse, RequestHandler } from 'msw';
import * as mocks from '../api/endpoints/index.msw';
import * as zodMocks from '../api/endpoints-zod/index.msw';

const demoValidPet = {
  id: 1,
  name: 'Fluffy',
  tag: 'cat',
  phone: '+15551234567',
  requiredNullableString: null,
};

const demoInvalidPet = {
  ...demoValidPet,
  phone: 'invalid-phone',
};

// TODO: This is a temporary override for showPetById to handle Accept header content negotiation.
// The MSW generator needs to be fixed to generate this logic automatically (see issue #2243).
const customShowPetByIdHandler = http.get(
  '*/v:version/pets/:petId',
  ({ request, params }) => {
    const accept = request.headers.get('Accept') || 'application/json';
    const petId = params['petId'];
    const mockPet = { id: Number(petId), name: 'Fluffy', tag: 'cat' };

    if (accept.includes('xml') || accept.includes('json')) {
      return HttpResponse.json(mockPet, {
        headers: { 'Content-Type': accept },
      });
    }
    return new HttpResponse(`Pet ${petId}: Fluffy the cat`, {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
);

// Demo-only runtime validation handlers for zod-validation-demo component.
// These are deterministic by design:
// - /search (body mode): intentionally invalid phone values to demonstrate Zod failures
// - /search (events/response mode): valid payloads
// - /pets/:petId: valid payload for stable JSON parse success
const customZodDemoSearchHandler = http.get(
  ({ request }) => {
    const url = new URL(request.url);
    return (
      url.pathname.endsWith('/search') &&
      url.searchParams.get('demoValidation') === '1'
    );
  },
  ({ request }) => {
    const url = new URL(request.url);
    const demoMode = url.searchParams.get('demoMode');

    if (demoMode === 'body') {
      return HttpResponse.json([demoInvalidPet, demoInvalidPet], {
        status: 200,
      });
    }

    return HttpResponse.json([demoValidPet, { ...demoValidPet, id: 2 }], {
      status: 200,
    });
  },
);

const customZodDemoShowPetByIdHandler = http.get(
  ({ request }) => {
    const url = new URL(request.url);
    return (
      /\/pets\/[^/]+$/.test(url.pathname) &&
      url.searchParams.get('demoValidation') === '1'
    );
  },
  () => HttpResponse.json(demoInvalidPet, { status: 200 }),
);

const generatedHandlers = Object.entries(mocks)
  .filter(([name]) => name !== 'getShowPetByIdMockHandler')
  .flatMap(([, getMock]) => (getMock as () => RequestHandler[])());

const zodHandlers = Object.entries(zodMocks).flatMap(([, getMock]) =>
  (getMock as () => RequestHandler[])(),
);

const handlers = [
  customZodDemoSearchHandler,
  customZodDemoShowPetByIdHandler,
  customShowPetByIdHandler,
  ...generatedHandlers,
  ...zodHandlers,
];
const worker = setupWorker(...handlers);

export { worker };
