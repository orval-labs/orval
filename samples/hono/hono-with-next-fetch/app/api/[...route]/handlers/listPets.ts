import { createFactory } from 'hono/factory';
import { zValidator } from '../route.validator';
import { ListPetsContext } from '../route.context';
import { listPetsQueryParams, listPetsResponse } from '../route.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  zValidator('response', listPetsResponse),
  async (c: ListPetsContext) => {},
);
