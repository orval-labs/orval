import { setupServer } from 'msw/node';
import { getPetsMock } from './endpoints/pets/pets.msw';

const server = setupServer(...getPetsMock());

export { server };
