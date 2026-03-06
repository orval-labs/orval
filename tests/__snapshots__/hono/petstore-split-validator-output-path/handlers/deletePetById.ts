import { createFactory } from 'hono/factory';

import { DeletePetByIdContext } from '../endpoints.context';
import { deletePetByIdParams } from '../endpoints.zod';
import { zValidator } from './validator';

const factory = createFactory();

export const deletePetByIdHandlers = factory.createHandlers(
  zValidator('param', deletePetByIdParams),
  async (c: DeletePetByIdContext) => {},
);
