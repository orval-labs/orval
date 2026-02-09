import { setupWorker } from 'msw/browser';
import { getPetsMock } from '../gen/pets/pets.msw';

export const worker = setupWorker(...getPetsMock());
