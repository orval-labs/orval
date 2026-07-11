import { beforeAll, afterEach, afterAll } from 'vite-plus/test';
import { server } from './src/api/node';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
