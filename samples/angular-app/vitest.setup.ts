import { beforeAll, afterEach, afterAll } from 'vite-plus/test';
import { server } from './src/orval/node';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
