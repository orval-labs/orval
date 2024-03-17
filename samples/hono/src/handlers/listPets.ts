import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { ListPetsContext, listPetsQueryParams } from '../petstore';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  (c: ListPetsContext) => {
    return c.json({ message: 'listPets handler' });
  },
);
