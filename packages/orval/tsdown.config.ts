import { defineConfig } from 'tsdown';

import { baseOptions } from '../tsdown.base';

export default defineConfig({
  ...baseOptions,
  entry: ['src/bin/orval.ts', 'src/index.ts'],
});
