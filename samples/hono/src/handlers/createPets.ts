import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { CreatePetsContext } from '../petstore.context';
import { createPetsBody } from '../petstore.zod';

const factory = createFactory();


export const createPetsHandlers = factory.createHandlers(
zValidator('json', createPetsBody),
(c: CreatePetsContext) => {
  
  },
);
