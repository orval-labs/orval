import { createFactory } from 'hono/factory';

import { ListPetsContext } from '../pets/pets.context';
import { ListPetsQueryParams, ListPetsResponse } from '../pets/pets.zod';
import { zValidator } from '../petstore.validator';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  zValidator('query', ListPetsQueryParams),
  zValidator('response', ListPetsResponse),
  async (c: ListPetsContext) => {},
);
