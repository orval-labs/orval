import { join } from 'node:path';
import process from 'node:process';
import remarkPlugins from './src/lib/docs/remark-plugins.js';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { esmExternals: 'loose' },
  pageExtensions: ['jsx', 'js', 'ts', 'tsx', 'mdx', 'md'],
  rewrites: async () => [
    {
      source: '/docs{/}?',
      destination: '/docs/overview',
    },
  ],
  webpack: (config, { dev, isServer, ...options }) => {
    config.module.rules.push({
      test: /.mdx?$/, // load both .md and .mdx files
      use: [
        options.defaultLoaders.babel,
        {
          loader: '@mdx-js/loader',
          options: {
            remarkPlugins,
          },
        },
        join(__dirname, 'src/lib/docs/md-loader.js'),
      ],
    });

    if (!dev && isServer) {
      // we're in build mode so enable shared caching for the GitHub API
      process.env.USE_CACHE = 'true';
      const originalEntry = config.entry;

      config.entry = async () => {
        const entries = { ...(await originalEntry()) };
        return entries;
      };
    }

    return config;
  },
};

export default nextConfig;
