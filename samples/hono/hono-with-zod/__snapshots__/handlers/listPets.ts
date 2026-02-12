import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ListPetsContext } from '../pets/pets.context';
import { ListPetsQueryParams, ListPetsResponse } from '../pets/pets.zod';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  zValidator('query', ListPetsQueryParams),
  zValidator('response', ListPetsResponse),
  async (c: ListPetsContext) => {},
);
