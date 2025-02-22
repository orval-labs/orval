import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { GetCatByIdContext } from '../petstore.context';
import { getCatByIdParams, getCatByIdResponse } from '../petstore.zod';

const factory = createFactory();

export const getCatByIdHandlers = factory.createHandlers(
  zValidator('param', getCatByIdParams),
  zValidator('response', getCatByIdResponse),
  async (c: GetCatByIdContext) => {},
);
