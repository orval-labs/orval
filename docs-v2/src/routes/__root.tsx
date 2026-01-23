import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import * as React from 'react';

import appCss from '@/styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Orval - Generate type-safe API clients from OpenAPI',
      },
      {
        name: 'description',
        content:
          'Generate type-safe TypeScript clients from OpenAPI specifications. Supports React Query, Angular, Vue Query, SWR, and more.',
      },
      {
        property: 'og:title',
        content: 'Orval - Generate type-safe API clients from OpenAPI',
      },
      {
        property: 'og:description',
        content:
          'Generate type-safe TypeScript clients from OpenAPI specifications. Supports React Query, Angular, Vue Query, SWR, and more.',
      },
      {
        property: 'og:image',
        content: '/images/og-image.png',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/images/favicon.svg', type: 'image/svg+xml' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&display=swap',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
