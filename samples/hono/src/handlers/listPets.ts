import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { ListPetsContext } from '../petstore.context';
import { listPetsQueryParams } from '../petstore.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  (c: ListPetsContext) => {},
);
