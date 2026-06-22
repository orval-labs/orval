import { createFileRoute } from '@tanstack/react-router';

import { HomePage } from '@/components/home/home-page';
import { getSponsors } from '@/lib/sponsors';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const sponsors = await getSponsors();
    return { sponsors };
  },
});

function Home() {
  const { sponsors } = Route.useLoaderData();

  return <HomePage locale="en" sponsors={sponsors} />;
}
