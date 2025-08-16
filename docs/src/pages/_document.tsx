import { Head, Html, Main, NextScript } from 'next/document';

export default function MyDocument() {
  return (
    <Html>
      <Head>
        <script
          defer
          data-domain="orval.dev"
          src="https://anatomy.anymaniax.com/js/script.js"
        ></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body className="font-sans antialiased text-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
