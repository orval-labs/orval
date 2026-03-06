import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { DeletePetByIdContext } from '../endpoints.context';
import {
deletePetByIdParams
} from '../endpoints.zod'

const factory = createFactory();


export const deletePetByIdHandlers = factory.createHandlers(
zValidator('param', deletePetByIdParams),
async (c: DeletePetByIdContext) => {

  },
);
