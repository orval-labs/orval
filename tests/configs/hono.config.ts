import { defineConfig } from 'orval';

export default defineConfig({
  endpointParameters: {
    input: '../specifications/parameters.yaml',
    output: {
      target: '../generated/hono/endpoint-parameters/endpoints.ts',
      schemas: '../generated/hono/endpoint-parameters/schemas',
      mode: 'split',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
  zodSchemaResponse: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/hono/zod-schema-response/schemas',
      },
      mode: 'single',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
  petstoreSingle: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-single/endpoints.ts',
      mode: 'single',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
  petstoreSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split/endpoints.ts',
      mode: 'split',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
  petstoreTags: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags/endpoints.ts',
      mode: 'tags',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
  petstoreTagsSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags-split/endpoints.ts',
      mode: 'tags-split',
      client: 'hono',
      clean: true,
      prettier: true,
    },
  },
});
