import { createFactory } from 'hono/factory';
import { zValidator } from './endpoints.validator';
import { ListPetsContext,
CreatePetsContext,
ShowPetByIdContext,
DeletePetByIdContext } from './pets.context';
import {
listPetsQueryParams,
createPetsQueryParams,
createPetsBody,
createPetsResponse,
showPetByIdParams,
showPetByIdResponse,
deletePetByIdParams
} from './pets.zod'

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
zValidator('query', listPetsQueryParams),
async (c: ListPetsContext) => {

  },
);
export const createPetsHandlers = factory.createHandlers(
zValidator('query', createPetsQueryParams),
zValidator('json', createPetsBody),
zValidator('response', createPetsResponse),
async (c: CreatePetsContext) => {

  },
);
export const showPetByIdHandlers = factory.createHandlers(
zValidator('param', showPetByIdParams),
zValidator('response', showPetByIdResponse),
async (c: ShowPetByIdContext) => {

  },
);
export const deletePetByIdHandlers = factory.createHandlers(
zValidator('param', deletePetByIdParams),
async (c: DeletePetByIdContext) => {

  },
);