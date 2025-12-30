// global MDX Component
// https://nextjs.org/docs/pages/guides/mdx#add-an-mdx-componentstsx-file
// https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components

import type { MDXComponents } from 'mdx/types';
import LayoutDocs from '@/components/LayoutDocs';
import Highlight2 from '@/components/Highlight2';

const components: MDXComponents = {
  pre: ({ children }) => (
    <Highlight2
      className={children.props.className}
      children={children.props.children}
    />
  ),
  wrapper: (props) => <LayoutDocs {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
