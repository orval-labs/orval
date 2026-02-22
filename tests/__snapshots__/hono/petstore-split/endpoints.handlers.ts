import { createFactory } from 'hono/factory';
import { zValidator } from './endpoints.validator';
import {
  ListPetsContext,
  CreatePetsContext,
  ShowPetByIdContext,
  DeletePetByIdContext,
  HealthCheckContext,
  ShowPetWithOwnerContext,
} from './endpoints.context';
import {
  ListPetsQueryParams,
  CreatePetsQueryParams,
  CreatePetsBody,
  CreatePetsResponse,
  ShowPetByIdParams,
  ShowPetByIdResponse,
  DeletePetByIdParams,
  ShowPetWithOwnerParams,
  ShowPetWithOwnerResponse,
} from './endpoints.zod';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  zValidator('query', ListPetsQueryParams),
  async (c: ListPetsContext) => {},
);
export const createPetsHandlers = factory.createHandlers(
  zValidator('query', CreatePetsQueryParams),
  zValidator('json', CreatePetsBody),
  zValidator('response', CreatePetsResponse),
  async (c: CreatePetsContext) => {},
);
export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', ShowPetByIdParams),
  zValidator('response', ShowPetByIdResponse),
  async (c: ShowPetByIdContext) => {},
);
export const deletePetByIdHandlers = factory.createHandlers(
  zValidator('param', DeletePetByIdParams),
  async (c: DeletePetByIdContext) => {},
);
export const healthCheckHandlers = factory.createHandlers(
  async (c: HealthCheckContext) => {},
);
export const showPetWithOwnerHandlers = factory.createHandlers(
  zValidator('param', ShowPetWithOwnerParams),
  zValidator('response', ShowPetWithOwnerResponse),
  async (c: ShowPetWithOwnerContext) => {},
);
