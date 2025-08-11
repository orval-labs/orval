import '@docsearch/css';
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { SearchProvider } from '@/components/useSearch';
import { useState } from 'react';
import '@/styles/index.css';
import type { AppProps } from 'next/app'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={pageProps.dehydratedState}>
        <SearchProvider>
          <Component {...pageProps} />
        </SearchProvider>
      </Hydrate>
    </QueryClientProvider>
  );
}
