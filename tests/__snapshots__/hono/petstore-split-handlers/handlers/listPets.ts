import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import {
listPetsQueryParams
} from '../endpoints.zod'

const factory = createFactory();


export const listPetsHandlers = factory.createHandlers(
zValidator('query', listPetsQueryParams),
async (c: ListPetsContext) => {

  },
);
