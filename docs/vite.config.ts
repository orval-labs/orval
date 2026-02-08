import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import mdx from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { generateMdPages } from './plugins/generate-md-pages';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    generateMdPages(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    mdx(await import('./source.config')),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      prerender: {
        enabled: true,
      },
    }),
    react(),
  ],
});
