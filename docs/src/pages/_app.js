import '@docsearch/react/dist/style.css';
import * as Sentry from '@sentry/node';
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { SearchProvider } from 'components/useSearch';
import Head from 'next/head';
import { useState } from 'react';
import '../styles/index.css';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    enabled: process.env.NODE_ENV === 'production',
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
}

function MyApp({ Component, pageProps, err }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
        @media (max-width: 390px) {
            .formkit-slide-in {
              display: none;
            }
          }
          @media (max-height: 740px) {
            .formkit-slide-in {
              display: none;
            }
          }
          `,
          }}
        />
      </Head>
      <QueryClientProvider client={queryClient}>
        <Hydrate state={pageProps.dehydratedState}>
          <SearchProvider>
            <Component {...pageProps} err={err} />
          </SearchProvider>
        </Hydrate>
      </QueryClientProvider>
    </>
  );
}

export default MyApp;
