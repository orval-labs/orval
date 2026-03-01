import { defineConfig } from 'tsdown';

import { baseConfig } from '../tsdown.base.ts';

export default defineConfig({
  ...baseConfig,
  entry: ['src/bin/orval.ts', 'src/index.ts'],
});
