import { createFactory } from 'hono/factory';
import { zValidator } from './validator';
import { CreatePetsContext } from '../endpoints.context';
import {
createPetsQueryParams,
createPetsBody,
createPetsResponse
} from '../endpoints.zod'

const factory = createFactory();


export const createPetsHandlers = factory.createHandlers(
zValidator('query', createPetsQueryParams),
zValidator('json', createPetsBody),
zValidator('response', createPetsResponse),
async (c: CreatePetsContext) => {

  },
);
