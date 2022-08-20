import { defineConfig } from '../../src';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: './petstore.ts',
      client: 'zod',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
