import { createFactory } from 'hono/factory';

import { ShowPetByIdContext } from '../endpoints.context';
import { zValidator } from '../endpoints.validator';
import { showPetByIdParams, showPetByIdResponse } from '../endpoints.zod';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  zValidator('response', showPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
