import { setupWorker } from 'msw/browser';
import { getSwaggerPetstoreMock } from './api/endpoints/petstoreFromFileSpecWithTransformer.msw';

const worker = setupWorker(...getSwaggerPetstoreMock());

worker.start();
