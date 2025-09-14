import { defineConfig } from 'tsup';

import { baseOptions } from '../tsup.base';

export default defineConfig({
  ...baseOptions,
  entry: ['src/bin/orval.ts', 'src/index.ts'],
});
