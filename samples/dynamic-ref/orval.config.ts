import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: './petstore-dynamic.yaml',
    output: {
      target: './api/petstore.ts',
      client: 'axios',
      formatter: 'prettier',
    },
  },
});
