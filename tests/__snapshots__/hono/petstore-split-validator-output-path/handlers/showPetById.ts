import { createFactory } from 'hono/factory';

import { ShowPetByIdContext } from '../endpoints.context';
import { showPetByIdParams, showPetByIdResponse } from '../endpoints.zod';
import { zValidator } from './validator';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  zValidator('response', showPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
