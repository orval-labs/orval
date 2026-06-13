import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import * as siteConfig from 'site.config.json';

import type { Locale } from '@/lib/i18n';
import { i18n as i18nConfig } from '@/lib/i18n';

interface BaseOptions {
  i18n?: boolean;
}

export function baseOptions(
  locale: Locale = i18nConfig.defaultLanguage,
  options: BaseOptions = {},
): BaseLayoutProps {
  const isZh = locale === 'zh';

  return {
    ...(options.i18n ? { i18n: i18nConfig } : {}),
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
        text: isZh ? '文档' : 'Docs',
        url: isZh ? '/zh/docs' : '/docs',
        active: 'nested-url',
      },
      {
        text: isZh ? '演练场' : 'Playground',
        url: isZh ? '/zh/playground' : '/playground',
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
        text: isZh ? '赞助' : 'Sponsor',
        url: siteConfig.openCollectiveUrl,
        external: true,
      },
    ],
  };
}
