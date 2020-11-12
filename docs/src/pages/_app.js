import '@docsearch/react/dist/style.css';
import { SearchProvider } from 'components/useSearch';
import Head from 'next/head';
import React from 'react';
import '../styles/index.css';

function MyApp({ Component, pageProps }) {
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
      <SearchProvider>
        <Component {...pageProps} />
      </SearchProvider>
    </>
  );
}

export default MyApp;
