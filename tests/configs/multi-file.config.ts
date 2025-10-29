import { defineConfig } from 'orval';

// test esm module import
export { MY_CONST } from './my-module';

export default defineConfig({
  api: {
    input: '../specifications/multi-files/api.yaml',
    output: '../generated/multi-files/api/endpoints.ts',
  },
});
