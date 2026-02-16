import { setupServer } from 'msw/node';
import { getPetsMock } from '../gen/pets/pets.msw';

export const server = setupServer(...getPetsMock());
