import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { UpdatePetsContext } from '../petstore.context';
import { updatePetsBody } from '../petstore.zod';

const factory = createFactory();


export const updatePetsHandlers = factory.createHandlers(
zValidator('json', updatePetsBody),
(c: UpdatePetsContext) => {
  
  },
);
