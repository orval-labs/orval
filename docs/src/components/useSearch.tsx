import { useDocSearchKeyboardEvents } from '@docsearch/react';
import Head from 'next/head';
import Router from 'next/router';
import React, { ComponentPropsWithoutRef } from 'react';
import { createPortal } from 'react-dom';
import { siteConfig } from '@/siteConfig';
import { getManifest } from '@/manifests/getManifest';
import { removeFromLast } from '@/lib/docs/utils';

const SearchContext = React.createContext<
  | {
      DocSearchModal: any;
      onOpen: () => void;
    }
  | undefined
>(undefined);
let DocSearchModal: any = null;

function collectParentCategoryUrls(routes: any[]): string[] {
  return routes.flatMap((route) => {
    if (!(route.routes && !route.path && !route.href)) {
      return [];
    }

    const firstChild = route.routes.find((r: any) => r.path);
    const parentUrl = firstChild ? removeFromLast(firstChild.path, '/') : null;
    const childUrls = collectParentCategoryUrls(route.routes);

    return parentUrl ? [parentUrl, ...childUrls] : childUrls;
  });
}

const parentCategoryUrls = (() => {
  const manifest = getManifest(undefined);
  return collectParentCategoryUrls(manifest.routes);
})();

export const useSearch = () =>
  React.useContext(SearchContext) as unknown as {
    onOpen: () => void;
  };

interface Props extends ComponentPropsWithoutRef<'div'> {
  searchParameters?: { hitsPerPage: number };
}

export function SearchProvider({
  children,
  searchParameters = {
    hitsPerPage: 5,
  },
}: Props) {
  const searchRef = React.useRef(null);
  const [isShowing, setIsShowing] = React.useState(false);

  const onOpen = React.useCallback(function onOpen() {
    function importDocSearchModalIfNeeded() {
      if (DocSearchModal) {
        return Promise.resolve();
      }

      return import('@docsearch/react/modal').then(
        ({ DocSearchModal: Modal }) => (DocSearchModal = Modal),
      );
    }

    importDocSearchModalIfNeeded().then(() => {
      setIsShowing(true);
    });
  }, []);

  const onClose = React.useCallback(() => setIsShowing(false), []);

  useDocSearchKeyboardEvents({
    isOpen: isShowing,
    onOpen,
    onClose,
    // searchButtonRef is required but this was done to satisfy the type,
    // it doesn't appear to do anything
    searchButtonRef: searchRef,
  });

  const options = {
    appId: siteConfig.algolia.appId,
    apiKey: siteConfig.algolia.apiKey,
    indexName: siteConfig.algolia.indexName,
    renderModal: true,
  };

  return (
    <>
      <Head>
        <link
          key="algolia"
          rel="preconnect"
          href={`https://${options.appId}-dsn.algolia.net`}
          crossOrigin="anonymous"
        />
      </Head>
      <SearchContext.Provider value={{ DocSearchModal, onOpen }}>
        {children}
      </SearchContext.Provider>
      {isShowing &&
        createPortal(
          <DocSearchModal
            {...options}
            searchParameters={searchParameters}
            onClose={onClose}
            navigator={{
              navigate({ itemUrl }) {
                Router.push(itemUrl);
              },
            }}
            transformItems={(items) => {
              return items.map((item) => {
                  if (parentCategoryUrls.includes(item.url)) {
                    return null;
                  }

                  return item;
                })
                .filter((item) => item !== null);
            }}
          />,
          document.body,
        )}
    </>
  );
}
