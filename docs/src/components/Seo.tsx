import Head from 'next/head';
import { useRouter } from 'next/router';
import { ComponentPropsWithoutRef } from 'react';

interface Props extends ComponentPropsWithoutRef<'head'> {
  title: string;
  description?: string;
}

export function Seo({ title, description, children }: Props) {
  const router = useRouter();

  return (
    <Head>
      {/* DEFAULT */}

      {title != undefined && <title key="title">{title} | orval</title>}
      {description != undefined && (
        <meta name="description" key="description" content={description} />
      )}
      <link rel="icon" type="image/x-icon" href="/images/favicon.svg" />
      <link rel="apple-touch-icon" href="/images/favicon.svg" />

      {/* OPEN GRAPH */}
      <meta property="og:type" key="og:type" content="website" />
      <meta
        property="og:url"
        key="og:url"
        content={`https://orval.dev${router.pathname}`}
      />
      {title != undefined && (
        <meta property="og:title" content={title} key="og:title" />
      )}
      {description != undefined && (
        <meta
          property="og:description"
          key="og:description"
          content={description}
        />
      )}
      <meta
        property="og:image"
        key="og:image"
        content={`https://orval.dev/images/og-image.png`}
      />

      {/* TWITTER */}
      <meta
        name="twitter:card"
        key="twitter:card"
        content="summary_large_image"
      />
      <meta name="twitter:site" key="twitter:site" content="@anymaniax" />
      <meta name="twitter:creator" key="twitter:creator" content="@anymaniax" />
      {title != undefined && (
        <meta name="twitter:title" key="twitter:title" content={title} />
      )}
      {description != undefined && (
        <meta
          name="twitter:description"
          key="twitter:description"
          content={description}
        />
      )}

      <meta
        name="twitter:image"
        key="twitter:image"
        content={`https://orval.dev/images/og-image.png`}
      />

      {children}
    </Head>
  );
}
