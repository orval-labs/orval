'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const orval_1 = require('orval');
exports.default = (0, orval_1.defineConfig)({
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
    },
  },
});
