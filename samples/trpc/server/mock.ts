import { setupServer } from 'msw/node';
import { getSwaggerPetstoreMSW } from '../client/src/api/endpoints/petstore.msw';

const server = setupServer(...getSwaggerPetstoreMSW());

server.listen();
