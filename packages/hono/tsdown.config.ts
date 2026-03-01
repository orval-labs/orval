import { defineConfig } from 'tsdown';

import { baseConfig } from '../tsdown.base.ts';

export default defineConfig({
  ...baseConfig,
  copy: ['src/zValidator.ts'],
});
