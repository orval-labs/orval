import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { CreatePetsContext } from '../petstore.context';
import { createPetsBody, createPetsResponse } from '../petstore.zod';

const factory = createFactory();

export const createPetsHandlers = factory.createHandlers(
  zValidator('json', createPetsBody),
  zValidator('response', createPetsResponse),
  async (c: CreatePetsContext) => {},
);
