import { setupWorker } from 'msw/browser';
import { http, HttpResponse, RequestHandler } from 'msw';
import * as mocks from '../api/endpoints/index.msw';

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

const generatedHandlers = Object.entries(mocks)
  .filter(([name]) => name !== 'getShowPetByIdMockHandler')
  .flatMap(([, getMock]) => (getMock as () => RequestHandler[])());

const handlers = [customShowPetByIdHandler, ...generatedHandlers];
const worker = setupWorker(...handlers);

export { worker };
