import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: ['axios'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
  },
});
