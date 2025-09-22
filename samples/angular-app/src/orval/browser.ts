import { setupWorker } from 'msw/browser';
import * as mocks from '../api/endpoints/index.msw';

const handlers = Object.entries(mocks).flatMap(([, getMock]) => getMock());
const worker = setupWorker(...handlers);

export { worker };
