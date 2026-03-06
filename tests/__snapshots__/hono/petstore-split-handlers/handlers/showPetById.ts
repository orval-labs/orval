import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ShowPetByIdContext } from '../endpoints.context';
import {
showPetByIdParams,
showPetByIdResponse
} from '../endpoints.zod'

const factory = createFactory();


export const showPetByIdHandlers = factory.createHandlers(
zValidator('param', showPetByIdParams),
zValidator('response', showPetByIdResponse),
async (c: ShowPetByIdContext) => {

  },
);
