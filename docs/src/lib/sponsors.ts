import { createServerFn } from '@tanstack/react-start';

interface OpenCollectiveMember {
  name: string;
  image: string;
  profile: string;
  role: string;
  tier: string | null;
  totalAmountDonated: number;
}

export interface Sponsor {
  name: string;
  image: string;
  profile: string;
  amount: number;
}

const FETCH_TIMEOUT_MS = 5000;

const fetchWithTimeout = (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
};

async function fetchOpenCollectiveSponsors(): Promise<Sponsor[]> {
  try {
    const response = await fetchWithTimeout(
      'https://opencollective.com/orval/members/all.json',
    );
    const members: OpenCollectiveMember[] = await response.json();

    return members
      .filter(
        (m) =>
          m.role === 'BACKER' &&
          m.image &&
          !m.image.includes('anonymous') &&
          m.totalAmountDonated > 0,
      )
      .map((m) => ({
        name: m.name,
        image: m.image,
        profile: m.profile,
        amount: m.totalAmountDonated,
      }))
      .sort((a, b) => b.amount - a.amount);
  } catch (error) {
    console.error('Failed to fetch Open Collective sponsors:', error);
    return [];
  }
}

export const getSponsors = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sponsors = await fetchOpenCollectiveSponsors();

    const goldSponsors = sponsors.filter((s) => s.amount >= 500);
    const silverSponsors = sponsors.filter(
      (s) => s.amount >= 100 && s.amount < 500,
    );
    const backers = sponsors.filter((s) => s.amount < 100);

    return { goldSponsors, silverSponsors, backers };
  },
);
