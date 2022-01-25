import '@docsearch/react/dist/style.css';
import * as Sentry from '@sentry/node';
import { SearchProvider } from 'components/useSearch';
import Head from 'next/head';
import React from 'react';
import '../styles/index.css';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    enabled: process.env.NODE_ENV === 'production',
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
}

function MyApp({ Component, pageProps, err }) {
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
        <script async src="https://unpkg.com/thesemetrics@latest"></script>
        <script defer data-domain="orval.dev" src="http://analytics.anymaniax.com/js/plausible.js"></script>
      </Head>
      <SearchProvider>
        <Component {...pageProps} err={err} />
      </SearchProvider>
    </>
  );
}

export default MyApp;
