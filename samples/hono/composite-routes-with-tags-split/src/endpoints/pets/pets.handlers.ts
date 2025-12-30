import { createFactory } from 'hono/factory';
import { zValidator } from '../validator';
import {
  ListPetsContext,
  CreatePetsContext,
  UpdatePetsContext,
  ShowPetByIdContext,
} from './pets.context';
import {
  ListPetsQueryParams,
  ListPetsResponse,
  CreatePetsBody,
  CreatePetsResponse,
  UpdatePetsBody,
  UpdatePetsResponse,
  ShowPetByIdParams,
  ShowPetByIdResponse,
} from './pets.zod';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  zValidator('query', ListPetsQueryParams),
  zValidator('response', ListPetsResponse),
  async (c: ListPetsContext) => {},
);
export const createPetsHandlers = factory.createHandlers(
  zValidator('json', CreatePetsBody),
  zValidator('response', CreatePetsResponse),
  async (c: CreatePetsContext) => {},
);
export const updatePetsHandlers = factory.createHandlers(
  zValidator('json', UpdatePetsBody),
  zValidator('response', UpdatePetsResponse),
  async (c: UpdatePetsContext) => {},
);
export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', ShowPetByIdParams),
  zValidator('response', ShowPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
