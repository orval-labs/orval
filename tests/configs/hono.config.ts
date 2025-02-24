import { defineConfig } from 'orval';

export default defineConfig({
  petstoreTagsSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/tags-split/endpoints.ts',
      schemas: '../generated/hono/tags-split/schemas',
      mode: 'tags-split',
      client: 'hono',
    },
  },
  petstoreTags: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/tags/endpoints.ts',
      schemas: '../generated/hono/tags/schemas',
      mode: 'tags',
      client: 'hono',
    },
  },
  petstoreSplit: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split/endpoints.ts',
      schemas: '../generated/hono/petstore-split/schemas',
      mode: 'split',
      client: 'hono',
    },
  },
  petstoreSplitHandlers: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-split-handlers/endpoints.ts',
      schemas: '../generated/hono/petstore-split-handlers/handlers/schemas',
      mode: 'split',
      client: 'hono',
      override: {
        hono: {
          handlers: '../generated/hono/petstore-split-handlers/handlers',
        },
      },
    },
  },
  petstoreSplitValidatorOutputPath: {
    input: '../specifications/petstore.yaml',
    output: {
      target:
        '../generated/hono/petstore-split-validator-output-path/endpoints.ts',
      schemas:
        '../generated/hono/petstore-split-validator-output-path/handlers/schemas',
      mode: 'split',
      client: 'hono',
      override: {
        hono: {
          handlers:
            '../generated/hono/petstore-split-validator-output-path/handlers',
          validatorOutputPath:
            '../generated/hono/petstore-split-validator-output-path/handlers/validator.ts',
        },
      },
    },
  },
  petstoreTagsSplitCompositeRoute: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/hono/petstore-tags-split-composite-route/endpoints',
      schemas: '../generated/hono/petstore-tags-split-composite-route/schemas',
      mode: 'tags-split',
      client: 'hono',
      override: {
        hono: {
          validatorOutputPath:
            '../generated/hono/petstore-tags-split-composite-route/endpoints/validator.ts',
          compositeRoute:
            'generated/hono/petstore-tags-split-composite-route/routes.ts',
        },
      },
    },
  },
});
