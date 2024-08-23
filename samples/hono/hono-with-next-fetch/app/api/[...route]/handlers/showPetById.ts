import { createFactory } from 'hono/factory';
import { zValidator } from '../route.validator';
import { ShowPetByIdContext } from '../route.context';
import { showPetByIdParams, showPetByIdResponse } from '../route.zod';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  zValidator('response', showPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
