import { setupWorker } from 'msw';
import { getSwaggerPetstoreMSW } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const worker = setupWorker(...getSwaggerPetstoreMSW());
