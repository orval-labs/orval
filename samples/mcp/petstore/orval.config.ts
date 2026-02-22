import { defineConfig } from 'orval';

export default defineConfig({
  mcp: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'single',
      client: 'mcp',
      baseUrl: 'https://petstore3.swagger.io/api/v3',
      target: 'src/handlers.ts',
      schemas: 'src/http-schemas',
      clean: true,
      prettier: true,
    },
  },
});
