import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import * as siteConfig from 'site.config.json';

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
        text: 'Playground',
        url: '/playground',
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
