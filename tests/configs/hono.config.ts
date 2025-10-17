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
  examples: {
    input: '../specifications/examples.yaml',
    output: {
      target: '../generated/hono/examples/endpoints.ts',
      mode: 'tags-split',
      client: 'hono',
    },
  },
});
