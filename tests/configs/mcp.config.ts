import { defineConfig } from 'orval';

export default defineConfig({
  petstoreSingle: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/mcp/single/handlers.ts',
      schemas: '../generated/mcp/single/http-schemas',
      mode: 'single',
      client: 'mcp',
      clean: true,
      formatter: 'prettier',
    },
  },
  zodSchemaResponse: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/mcp/zod-schema-response/handlers.ts',
      schemas: {
        type: 'zod',
        path: '../generated/mcp/zod-schema-response/http-schemas',
      },
      mode: 'single',
      client: 'mcp',
      clean: true,
      formatter: 'prettier',
    },
  },
  customServer: {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/mcp/custom-server/handlers.ts',
      schemas: '../generated/mcp/custom-server/http-schemas',
      mode: 'single',
      client: 'mcp',
      clean: true,
      formatter: 'prettier',
      override: {
        mcp: {
          server: {
            path: '../mutators/mcp-custom-server.ts',
            name: 'customServer',
          },
        },
      },
    },
  },
});
