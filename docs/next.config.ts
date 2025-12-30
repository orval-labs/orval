import type { NextConfig } from 'next';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings, {
  Options as AutolinkOptions,
} from 'rehype-autolink-headings';
import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';
import rehypeUnwrapImages from 'rehype-unwrap-images';
import remarkToc, { Options as TocOptions } from 'remark-toc';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter, {
  RemarkMdxFrontmatterOptions,
} from 'remark-mdx-frontmatter';
import createMDX from '@next/mdx';
import recmaNextjsStaticProps from 'recma-nextjs-static-props';

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

const withMdx = createMDX({
  // By default only the `.mdx` extension is supported.
  extension: /\.mdx?$/,
  options: {
    rehypePlugins: [
      rehypeSlug,
      rehypeUnwrapImages,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: {
            class: ['anchor'],
            title: 'Direct link to heading',
          },
        } satisfies AutolinkOptions,
      ],
    ],
    recmaPlugins: [recmaNextjsStaticProps],
    remarkPlugins: [
      remarkEmoji,
      remarkGfm,
      remarkImages,
      remarkFrontmatter,
      [
        remarkMdxFrontmatter,
        { name: 'meta' } satisfies RemarkMdxFrontmatterOptions,
      ],
      [remarkToc, { skip: 'Reference' } satisfies TocOptions],
    ],
  },
});

export default withMdx(nextConfig);
