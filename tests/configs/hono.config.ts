import { defineConfig } from 'orval';

export default defineConfig({
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
});
