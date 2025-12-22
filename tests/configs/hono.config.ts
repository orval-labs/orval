import { defineConfig } from 'orval';

export default defineConfig({
  endpointParameters: {
    input: '../specifications/parameters.yaml',
    output: {
      target: '../generated/hono/endpoint-parameters/endpoints.ts',
      schemas: '../generated/hono/endpoint-parameters/schemas',
      mode: 'split',
      client: 'hono',
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
    },
  },
  petstoreSingle: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-single/endpoints.ts',
      mode: 'single',
      client: 'hono',
    },
  },
  petstoreSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split/endpoints.ts',
      mode: 'split',
      client: 'hono',
    },
  },
  petstoreTags: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags/endpoints.ts',
      mode: 'tags',
      client: 'hono',
    },
  },
  petstoreTagsSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags-split/endpoints.ts',
      mode: 'tags-split',
      client: 'hono',
    },
  },
});
