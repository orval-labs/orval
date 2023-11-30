import { setupWorker } from 'msw/browser';
import { getSwaggerPetstoreMock } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const worker = setupWorker(...getSwaggerPetstoreMock());
