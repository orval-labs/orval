import { setupWorker } from 'msw';
import { getSwaggerPetstoreMSW } from './api/endpoints/petstoreFromFileSpecWithTransformer.msw';

const worker = setupWorker(...getSwaggerPetstoreMSW());

worker.start();
