import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ShowPetByIdContext } from '../petstore.context';
import { showPetByIdParams, showPetByIdResponse } from '../petstore.zod';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  zValidator('response', showPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
