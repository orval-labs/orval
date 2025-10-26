import * as React from 'react';
import NextLink from 'next/link';
import { removeFromLast } from '@/lib/docs/utils';
import { siteConfig } from '@/siteConfig';
import { FiThumbsDown, FiThumbsUp } from 'react-icons/fi';
import { TWButton } from './TWButton';

function areEqual(prevProps, props) {
  return prevProps.route?.path === props.route?.path;
}

type DocsPageFooterProps = {
  href?: string;
  route: any;
  prevRoute: any;
  nextRoute: any;
};
export const DocsPageFooter = React.memo(
  ({ route, prevRoute, nextRoute }: DocsPageFooterProps) => {
    const editUrl =
      route?.editUrl || route?.path
        ? `${siteConfig.editUrl}${route?.editUrl || route?.path}`
        : null;

    return (
      <>
        <div className="py-8">
          <nav className="flex space-between items-center">
            {prevRoute && prevRoute.path ? (
              <NextLink
                href={removeFromLast(prevRoute.path, '.')}
                className="grow  block"
              >
                <span className="text-sm block text-gray-500 mb-1 font-semibold">
                  ← Prev
                </span>
                <span className="text-xl block text-blue-600 font-semibold">
                  {prevRoute.title}
                </span>
              </NextLink>
            ) : (
              <div />
            )}
            {nextRoute && nextRoute.path && (
              <NextLink
                href={removeFromLast(nextRoute.path, '.')}
                className="grow text-right block"
              >
                <span className="text-sm block text-gray-500 mb-1 font-semibold">
                  Next →
                </span>
                <span className="text-xl block text-blue-600 font-semibold">
                  {nextRoute.title}
                </span>
              </NextLink>
            )}
          </nav>
        </div>

        {editUrl ? (
          <div className="mb-8">
            <a
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 underline"
            >
              Edit this page on GitHub
            </a>
          </div>
        ) : null}

        <div className="py-8 md:flex md:items-center md:py-8 border-t border-b">
          <div className="font-semibold text-xl mr-4 text-center mb-4 md:mb-0  md:text-left">
            Was this page helpful?
          </div>
          <div className="grid grid-cols-2 gap-3 w-auto max-w-xs mx-auto md:mx-2">
            <TWButton icon={<FiThumbsUp />}>Yes</TWButton>
            <TWButton icon={<FiThumbsDown />}>No</TWButton>
          </div>
        </div>
      </>
    );
  },
  areEqual,
);
DocsPageFooter.displayName = 'DocsPageFooter';
