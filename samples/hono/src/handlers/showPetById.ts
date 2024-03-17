import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { ShowPetByIdContext, showPetByIdParams } from '../petstore';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  (c: ShowPetByIdContext) => {
    return c.json({ message: 'showPetById handler' });
  },
);
