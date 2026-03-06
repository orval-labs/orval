import { createFactory } from 'hono/factory';

import { CreatePetsContext } from '../pets/pets.context';
import { CreatePetsBody, CreatePetsResponse } from '../pets/pets.zod';
import { zValidator } from '../petstore.validator';

const factory = createFactory();
export const createPetsHandlers = factory.createHandlers(
  zValidator('json', CreatePetsBody),
  zValidator('response', CreatePetsResponse),
  async (c: CreatePetsContext) => {},
);
