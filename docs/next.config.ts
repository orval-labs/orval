import process from 'node:process';
import type { NextConfig } from 'next';
// import remarkPlugins from './src/lib/docs/remark-plugins';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
// import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';
import rehypeUnwrapImages from 'rehype-unwrap-images';
import remarkToc from 'remark-toc';
import nextMdx from '@next/mdx';

const withMdx = nextMdx({
  // By default only the `.mdx` extension is supported.
  extension: /\.mdx?$/,
  options: {
    rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
    remarkPlugins: [
      // remarkEmoji,
      remarkGfm,
      remarkImages,
      rehypeUnwrapImages,
      remarkToc,
    ],
  },
});

// const nextConfig: NextConfig = {
//   pageExtensions: ['jsx', 'js', 'ts', 'tsx', 'mdx', 'md'],
//   rewrites: async () => [
//     {
//       source: '/docs{/}?',
//       destination: '/docs/overview',
//     },
//   ],
//   webpack: (config, { dev, isServer, ...options }) => {
//     config.module.rules.push({
//       test: /\.mdx?$/, // load both .md and .mdx files
//       use: [
//         options.defaultLoaders.babel,
//         {
//           loader: '@mdx-js/loader',
//           options: {
//             // remarkPlugins: remarkPlugins,
//           } satisfies Options,
//         },
//         join(__dirname, 'src/lib/docs/md-loader.ts'),
//       ],
//     });

//     if (!dev && isServer) {
//       // we're in build mode so enable shared caching for the GitHub API
//       process.env.USE_CACHE = 'true';
//       const originalEntry = config.entry;

//       config.entry = async () => {
//         const entries = { ...(await originalEntry()) };
//         return entries;
//       };
//     }

//     return config;
//   },
// };

const nextConfig: NextConfig = {
  // Support MDX files as pages:
  pageExtensions: ['md', 'mdx', 'tsx', 'ts', 'jsx', 'js'],
  rewrites: async () => [
    {
      source: '/docs{/}?',
      destination: '/docs/overview',
    },
  ],
  webpack: (config, { dev, isServer }) => {
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

export default withMdx(nextConfig);
