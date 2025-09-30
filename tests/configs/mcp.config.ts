import { defineConfig } from 'orval';

export default defineConfig({
  petstoreSingle: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/mcp/single/handlers.ts',
      schemas: '../generated/mcp/single/http-schemas',
      mode: 'single',
      client: 'mcp',
    },
  },
});
