import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { CreatePetsContext, createPetsBody } from '../petstore';

const factory = createFactory();

export const createPetsHandlers = factory.createHandlers(
  zValidator('json', createPetsBody),
  (c: CreatePetsContext) => {
    return c.json({ message: 'createPets handler' });
  },
);
