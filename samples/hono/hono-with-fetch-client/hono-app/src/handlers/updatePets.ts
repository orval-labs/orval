import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { UpdatePetsContext } from '../petstore.context';
import { updatePetsBody, updatePetsResponse } from '../petstore.zod';

const factory = createFactory();

export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', updatePetsBody),
  zValidator('response', updatePetsResponse),
  async (c: UpdatePetsContext) => {},
);
