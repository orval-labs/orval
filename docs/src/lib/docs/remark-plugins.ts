import type { PluggableList } from 'unified';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';
import rehypeUnwrapImages from 'rehype-unwrap-images';
import remarkToc from 'remark-toc';
import paragraphCustomAlertsPlugin from './remark-paragraph-alerts';

export default [
  rehypeSlug,
  paragraphCustomAlertsPlugin,
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

  remarkEmoji,
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
] satisfies PluggableList;
