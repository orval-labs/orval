import { createFactory } from 'hono/factory';

import {
  ListPetsByCountryContext,
  ListPetsByAgeContext,
} from './endpoints.context';
import { zValidator } from './endpoints.validator';
import {
  ListPetsByCountryParams,
  ListPetsByCountryQueryParams,
  ListPetsByAgeParams,
  ListPetsByAgeQueryParams,
} from './endpoints.zod';

const factory = createFactory();
export const listPetsByCountryHandlers = factory.createHandlers(
  zValidator('param', ListPetsByCountryParams),
  zValidator('query', ListPetsByCountryQueryParams),
  async (c: ListPetsByCountryContext) => {},
);
export const listPetsByAgeHandlers = factory.createHandlers(
  zValidator('param', ListPetsByAgeParams),
  zValidator('query', ListPetsByAgeQueryParams),
  async (c: ListPetsByAgeContext) => {},
);
