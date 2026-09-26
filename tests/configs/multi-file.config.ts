import { defineConfig } from 'orval';

// test esm module import/export
import { MY_CONST, ANOTHER_CONST } from './my-module';
console.log('TESTING ES MODULE IMPORT/EXPORT', MY_CONST, ANOTHER_CONST);
export { MY_CONST, ANOTHER_CONST };

export default defineConfig({
  logLevel: 'error',
  api: {
    input: {
      target: '../specifications/multi-files/api.yaml',
      parserOptions: { externalRefs: { allow: ['*'] } },
    },
    output: {
      target: '../generated/multi-files/api/endpoints.ts',
      clean: true,
      formatter: 'prettier',
    },
  },
});
