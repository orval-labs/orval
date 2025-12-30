import { defineConfig } from 'tsdown';

import { baseConfig } from '../tsdown.base';

export default defineConfig({
  ...baseConfig,
  copy: ['src/zValidator.ts'],
});
