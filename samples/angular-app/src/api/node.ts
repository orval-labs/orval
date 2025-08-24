import { setupServer } from 'msw/node';
import * as mocks from './endpoints/index.msw';

const handlers = Object.entries(mocks).flatMap(([, getMock]) => getMock());
const server = setupServer(...handlers);

export { server };
