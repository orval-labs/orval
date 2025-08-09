import { defineConfig } from 'orval';

export default defineConfig({
  petstoreSingleMutator: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/mcp/single-mutator/handlers.ts',
      schemas: '../generated/mcp/single-mutator/http-schemas',
      mode: 'single',
      client: 'mcp',
      override: {
        mutator: {
          path: '../mutators/mcp-client.ts',
          name: 'mcpInstance',
        },
      },
    },
  },
});
