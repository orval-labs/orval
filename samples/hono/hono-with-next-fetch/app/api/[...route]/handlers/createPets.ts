import { createFactory } from 'hono/factory';
import { zValidator } from '../route.validator';
import { CreatePetsContext } from '../route.context';
import { createPetsBody, createPetsResponse } from '../route.zod';

const factory = createFactory();

export const createPetsHandlers = factory.createHandlers(
  zValidator('json', createPetsBody),
  zValidator('response', createPetsResponse),
  async (c: CreatePetsContext) => {},
);
