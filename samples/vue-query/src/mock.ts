import { setupWorker } from 'msw/browser';
import { getSwaggerPetstoreMSW } from './api/endpoints/petstoreFromFileSpecWithTransformer.msw';

const worker = setupWorker(...getSwaggerPetstoreMSW());

worker.start();
