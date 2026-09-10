import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  use: { baseURL: 'http://127.0.0.1:5180' },
  webServer: {
    command: 'vp run dev',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
  },
});
