import { createFactory } from 'hono/factory';

import { DeletePetByIdContext } from '../endpoints.context';
import { zValidator } from '../endpoints.validator';
import { deletePetByIdParams } from '../endpoints.zod';

const factory = createFactory();

export const deletePetByIdHandlers = factory.createHandlers(
  zValidator('param', deletePetByIdParams),
  async (c: DeletePetByIdContext) => {},
);
