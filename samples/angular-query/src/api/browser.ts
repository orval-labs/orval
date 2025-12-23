import { setupWorker } from 'msw/browser';
import { getPetsMock } from './endpoints/pets/pets.msw';

const worker = setupWorker(...getPetsMock());

export { worker };
