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
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import nextMdx from '@next/mdx';

const withMdx = nextMdx({
  // By default only the `.mdx` extension is supported.
  extension: /\.mdx?$/,
  options: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          linkProperties: {
            class: ['anchor'],
            title: 'Direct link to heading',
          },
        },
      ],
    ],
    remarkPlugins: [
      // remarkEmoji,
      remarkGfm,
      remarkImages,
      rehypeUnwrapImages,
      [
        remarkToc,
        {
          skip: 'Reference',
          maxDepth: 6,
        },
      ],
      remarkFrontmatter,
      remarkMdxFrontmatter,
    ],
  },
});

const nextConfig: NextConfig = {
  experimental: {
    // fixes:
    // Module not found: ESM packages (chalk) need to be imported. Use 'import' to reference the package instead. https://nextjs.org/docs/messages/import-esm-externals
    esmExternals: 'loose',
  },
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
