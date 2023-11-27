import '@docsearch/css';
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { SearchProvider } from 'components/useSearch';
import Head from 'next/head';
import { useState } from 'react';
import '../styles/index.css';

function MyApp({ Component, pageProps, err }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={pageProps.dehydratedState}>
        <SearchProvider>
          <Component {...pageProps} err={err} />
        </SearchProvider>
      </Hydrate>
    </QueryClientProvider>
  );
}

export default MyApp;
