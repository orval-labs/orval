const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const visit = require('unist-util-visit');
const remarkPlugins = require('./src/lib/docs/remark-plugins');

module.exports = {
  pageExtensions: ['jsx', 'js', 'ts', 'tsx', 'mdx', 'md'],
  rewrites() {
    return [
      {
        source: '/docs{/}?',
        destination: '/docs/overview',
      },
    ];
  },
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
        path.join(__dirname, './src/lib/docs/md-loader'),
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
