import { useDocSearchKeyboardEvents } from '@docsearch/react';
import Head from 'next/head';
import Link from 'next/link';
import Router from 'next/router';
import React, { ComponentPropsWithoutRef } from 'react';
import { createPortal } from 'react-dom';
import { siteConfig } from '@/siteConfig';

const SearchContext = React.createContext<
  | {
      DocSearchModal: any;
      onOpen: () => void;
    }
  | undefined
>(undefined);
let DocSearchModal: any = null;

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
              navigate({ suggestionUrl }) {
                Router.push(suggestionUrl);
              },
            }}
            transformItems={(items) => {
              return items.map((item) => {
                const url = new URL(item.url);
                return {
                  ...item,
                  url: item.url
                    .replace(url.origin, '')
                    .replace('#__next', '')
                    .replace('/docs/#', '/docs/overview#')
                    .replace(/#([^/]+)$/, '/$1'),
                };
              });
            }}
            hitComponent={Hit}
          />,
          document.body,
        )}
    </>
  );
}

interface HitProps {
  hit: any;
  children: React.ReactElement;
}

function Hit({ hit, children }: HitProps) {
  return (
    <Link href={hit.url.replace()} legacyBehavior>
      {children}
    </Link>
  );
}
