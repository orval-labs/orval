import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const siteConfig = {
  name: 'Orval',
  description:
    'Generate type-safe API clients from OpenAPI specifications. TypeScript, React Query, Angular, Vue Query, SWR, and more.',
  repoUrl: 'https://github.com/orval-labs/orval',
  discordUrl: 'https://discord.gg/6fC2sjDU7w',
  openCollectiveUrl: 'https://opencollective.com/orval',
  editUrl: 'https://github.com/orval-labs/orval/edit/master/docs-v2/content/docs',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2">
          <img src="/images/emblem.svg" alt="Orval" className="h-6 w-6" />
          <span className="font-semibold">Orval</span>
        </div>
      ),
    },
    githubUrl: siteConfig.repoUrl,
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'GitHub',
        url: siteConfig.repoUrl,
        external: true,
      },
      {
        text: 'Discord',
        url: siteConfig.discordUrl,
        external: true,
      },
      {
        text: 'Sponsor',
        url: siteConfig.openCollectiveUrl,
        external: true,
      },
    ],
  };
}
