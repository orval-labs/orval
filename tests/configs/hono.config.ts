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
      formatter: 'prettier',
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
      formatter: 'prettier',
    },
  },
  petstoreSingle: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-single/endpoints.ts',
      mode: 'single',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
    },
  },
  petstoreSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split/endpoints.ts',
      mode: 'split',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
    },
  },
  petstoreTags: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags/endpoints.ts',
      mode: 'tags',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
    },
  },
  petstoreTagsSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags-split/endpoints.ts',
      mode: 'tags-split',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
    },
  },
  petstoreSplitWithHandlers: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split-with-handlers/endpoints.ts',
      mode: 'split',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
      override: {
        hono: {
          handlers:
            '../generated/hono/petstore-split-with-handlers/src/handlers',
        },
      },
    },
  },
  petstoreTagsWithHandlers: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags-with-handlers/endpoints.ts',
      mode: 'tags',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
      override: {
        hono: {
          handlers:
            '../generated/hono/petstore-tags-with-handlers/src/handlers',
        },
      },
    },
  },
  petstoreTagsSplitWithHandlers: {
    input: '../specifications/petstore.yaml',
    output: {
      target:
        '../generated/hono/petstore-tags-split-with-handlers/endpoints.ts',
      mode: 'tags-split',
      client: 'hono',
      clean: true,
      formatter: 'prettier',
      override: {
        hono: {
          handlers:
            '../generated/hono/petstore-tags-split-with-handlers/src/handlers',
        },
      },
    },
  },
});
