import { getSwaggerPetstoreMock } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const handlers = [...getSwaggerPetstoreMock()];
