import { createFactory } from 'hono/factory';

import { UpdatePetsContext } from '../petstore.context';
import { zValidator } from '../petstore.validator';
import { updatePetsBody, updatePetsResponse } from '../petstore.zod';

const factory = createFactory();

export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', updatePetsBody),
  zValidator('response', updatePetsResponse),
  async (c: UpdatePetsContext) => {},
);
