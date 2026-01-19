// global MDX Component
// https://nextjs.org/docs/pages/guides/mdx#add-an-mdx-componentstsx-file
// https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components

import type { MDXComponents } from 'mdx/types';
import LayoutDocs from '@/components/LayoutDocs';

const components: MDXComponents = {
  wrapper: (props) => <LayoutDocs {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
