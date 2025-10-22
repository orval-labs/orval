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
  transpilePackages: ['orval'],
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
      // remark-emoji@5.0.1 package throws 'ERR_PACKAGE_PATH_NOT_EXPORTED'
      // https://github.com/rhysd/remark-emoji/issues/40
      // remarkEmoji,
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
