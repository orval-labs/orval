import { createFactory } from 'hono/factory';

import { ShowPetByIdContext } from '../pets/pets.context';
import { ShowPetByIdParams, ShowPetByIdResponse } from '../pets/pets.zod';
import { zValidator } from '../petstore.validator';

const factory = createFactory();
export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', ShowPetByIdParams),
  zValidator('response', ShowPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
