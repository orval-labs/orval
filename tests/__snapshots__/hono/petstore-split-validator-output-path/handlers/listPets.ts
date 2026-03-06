import { createFactory } from 'hono/factory';

import { ListPetsContext } from '../endpoints.context';
import { listPetsQueryParams } from '../endpoints.zod';
import { zValidator } from './validator';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  async (c: ListPetsContext) => {},
);
