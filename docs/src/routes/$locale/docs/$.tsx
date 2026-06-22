import { createFileRoute } from '@tanstack/react-router';

import { DocsRoutePage, loadDocsRoute } from '@/components/docs/docs-page';

export const Route = createFileRoute('/$locale/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    return loadDocsRoute({
      locale: params.locale,
      slugs: params._splat?.split('/').filter(Boolean) ?? [],
    });
  },
});

function Page() {
  return <DocsRoutePage data={Route.useLoaderData()} />;
}
