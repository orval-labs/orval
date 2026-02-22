import { setupServer } from 'msw/node';
import * as mocks from '../api/endpoints/index.msw';
import * as zodMocks from '../api/endpoints-zod/index.msw';

const handlers = [
  ...Object.entries(mocks).flatMap(([, getMock]) => getMock()),
  ...Object.entries(zodMocks).flatMap(([, getMock]) => getMock()),
];
const server = setupServer(...handlers);

export { server };
