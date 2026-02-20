import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  getPetsMock,
  getListPetsResponseMock,
  getSearchPetsResponseMock,
} from './endpoints/pets/pets.msw';

// Additional handlers for non-versioned endpoints (no-transformer and custom-instance)
const nonVersionedHandlers = [
  // Handler for /pets (no version prefix)
  http.get('*/pets', () => {
    return HttpResponse.json(getListPetsResponseMock());
  }),
  // Handler for /search (no version prefix)
  http.get('*/search', () => {
    return HttpResponse.json(getSearchPetsResponseMock());
  }),
];

const server = setupServer(...getPetsMock(), ...nonVersionedHandlers);

export { server };
