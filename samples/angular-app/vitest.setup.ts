import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/orval/node';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
