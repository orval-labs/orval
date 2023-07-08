import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: '../specifications/multi-files/api.yaml',
    output: '../generated/multi-files/api/endpoints.ts',
  },
});
