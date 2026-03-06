import { createFactory } from 'hono/factory';

import { UpdatePetsContext } from '../pets/pets.context';
import { UpdatePetsBody, UpdatePetsResponse } from '../pets/pets.zod';
import { zValidator } from '../petstore.validator';

const factory = createFactory();
export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', UpdatePetsBody),
  zValidator('response', UpdatePetsResponse),
  async (c: UpdatePetsContext) => {},
);
