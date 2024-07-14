import { setupServer } from 'msw/node';
import { getSwaggerPetstoreMock } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const server = setupServer(...getSwaggerPetstoreMock());
