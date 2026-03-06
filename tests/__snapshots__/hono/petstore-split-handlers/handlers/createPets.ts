import { createFactory } from 'hono/factory';

import { CreatePetsContext } from '../endpoints.context';
import { zValidator } from '../endpoints.validator';
import {
  createPetsQueryParams,
  createPetsBody,
  createPetsResponse,
} from '../endpoints.zod';

const factory = createFactory();

export const createPetsHandlers = factory.createHandlers(
  zValidator('query', createPetsQueryParams),
  zValidator('json', createPetsBody),
  zValidator('response', createPetsResponse),
  async (c: CreatePetsContext) => {},
);
