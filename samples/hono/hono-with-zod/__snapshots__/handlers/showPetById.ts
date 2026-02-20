import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ShowPetByIdContext } from '../pets/pets.context';
import { ShowPetByIdParams, ShowPetByIdResponse } from '../pets/pets.zod';

const factory = createFactory();
export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', ShowPetByIdParams),
  zValidator('response', ShowPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
