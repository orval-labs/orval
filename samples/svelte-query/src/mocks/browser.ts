import { setupWorker } from 'msw/browser';
import { getSwaggerPetstoreMSW } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const worker = setupWorker(...getSwaggerPetstoreMSW());
