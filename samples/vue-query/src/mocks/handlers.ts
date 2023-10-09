import { getSwaggerPetstoreMSW } from '../api/endpoints/petstoreFromFileSpecWithTransformer.msw';

export const handlers = [...getSwaggerPetstoreMSW()];
