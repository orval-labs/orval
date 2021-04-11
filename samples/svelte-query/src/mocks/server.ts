import { setupServer } from 'msw/node';
import { getSwaggerPetstoreMSW } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const server = setupServer(...getSwaggerPetstoreMSW());
