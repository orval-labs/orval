import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore-paginated.yaml',
      filters: {
        tags: ['Pets', 'Owners', 'Species', 'Shelters'],
      },
    },
    output: {
      target: './api/endpoints.ts',
      schemas: './api/models',
      mode: 'tags-split',
      client: 'axios',
      formatter: 'prettier',
      clean: true,
    },
  },
});
