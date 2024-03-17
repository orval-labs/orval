import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { UpdatePetsContext, updatePetsBody } from '../petstore';

const factory = createFactory();

export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', updatePetsBody),
  (c: UpdatePetsContext) => {
    return c.json({ message: 'updatePets handler' });
  },
);
