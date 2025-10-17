import Document, { Head, Html, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="en">
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
        <body className="font-sans antialiased text-gray-900 relative">
          <a
            href="#main-landmark"
            className="transition left-0 bg-white text-primary-content absolute p-3 m-3 -translate-y-16 focus:translate-y-0 z-20"
          >
            Skip to main content
          </a>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
