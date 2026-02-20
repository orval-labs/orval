import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { UpdatePetsContext } from '../pets/pets.context';
import { UpdatePetsBody, UpdatePetsResponse } from '../pets/pets.zod';

const factory = createFactory();
export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', UpdatePetsBody),
  zValidator('response', UpdatePetsResponse),
  async (c: UpdatePetsContext) => {},
);
