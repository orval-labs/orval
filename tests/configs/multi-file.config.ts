/* eslint-disable simple-import-sort/exports */
/* eslint-disable simple-import-sort/imports */
/* eslint-disable unicorn/prefer-export-from */
import { defineConfig } from 'orval';

// test esm module import/export
import { MY_CONST, ANOTHER_CONST } from './my-module';
console.log('TESTING ES MODULE IMPORT/EXPORT', MY_CONST, ANOTHER_CONST);
export { MY_CONST, ANOTHER_CONST };

export default defineConfig({
  api: {
    input: '../specifications/multi-files/api.yaml',
    output: '../generated/multi-files/api/endpoints.ts',
  },
});
