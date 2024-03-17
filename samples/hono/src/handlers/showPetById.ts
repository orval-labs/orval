import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { ShowPetByIdContext } from '../petstore.context';
import { showPetByIdParams } from '../petstore.zod';

const factory = createFactory();


export const showPetByIdHandlers = factory.createHandlers(
zValidator('param', showPetByIdParams),
(c: ShowPetByIdContext) => {
  
  },
);
