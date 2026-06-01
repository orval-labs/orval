import { defineConfig } from 'vite-plus';
import type { OxfmtConfig } from 'vite-plus/fmt';
import type { OxlintConfig } from 'vite-plus/lint';

import fmtConfig from './.oxfmtrc.json' with { type: 'json' };
import lintConfig from './.oxlintrc.json' with { type: 'json' };

export default defineConfig({
  fmt: fmtConfig as OxfmtConfig,
  lint: lintConfig as OxlintConfig,
  staged: {
    '*.{ts,tsx,mts,cts,js,mjs,cjs,jsx}': 'vp fmt --write',
  },
});
