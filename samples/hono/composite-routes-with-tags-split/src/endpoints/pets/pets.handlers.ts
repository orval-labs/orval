import { createFactory } from 'hono/factory';
import { zValidator } from '../validator';
import { ListPetsContext,
CreatePetsContext,
UpdatePetsContext,
ShowPetByIdContext } from './pets.context';
import {
listPetsQueryParams,
listPetsResponse,
createPetsBody,
createPetsResponse,
updatePetsBody,
updatePetsResponse,
showPetByIdParams,
showPetByIdResponse
} from './pets.zod'

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
zValidator('query', listPetsQueryParams),
zValidator('response', listPetsResponse),
async (c: ListPetsContext) => {

  },
);
export const createPetsHandlers = factory.createHandlers(
zValidator('json', createPetsBody),
zValidator('response', createPetsResponse),
async (c: CreatePetsContext) => {

  },
);
export const updatePetsHandlers = factory.createHandlers(
zValidator('json', updatePetsBody),
zValidator('response', updatePetsResponse),
async (c: UpdatePetsContext) => {

  },
);
export const showPetByIdHandlers = factory.createHandlers(
zValidator('param', showPetByIdParams),
zValidator('response', showPetByIdResponse),
async (c: ShowPetByIdContext) => {

  },
);