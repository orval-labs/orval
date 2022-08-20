import { defineConfig } from '../../src';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: './src/petstore.ts',
      client: 'zod',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
