import { HomeLayout } from 'fumadocs-ui/layouts/home';
import * as siteConfig from 'site.config.json';

import type { Locale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

import { Playground } from './Playground';

const copy = {
  en: {
    metaTitle: siteConfig.playground.title,
    metaDescription: siteConfig.playground.description,
    title: 'Playground',
    description:
      'Try Orval in your browser. Edit the OpenAPI schema and configuration to see the generated TypeScript code in real-time.',
    hint: 'Changes are automatically regenerated after you stop typing.',
  },
  zh: {
    metaTitle: '演练场 - Orval',
    metaDescription:
      '在浏览器中试用 Orval，立即从 OpenAPI 规范生成类型安全的 TypeScript 客户端。',
    title: '演练场',
    description:
      '在浏览器中试用 Orval。编辑 OpenAPI schema 和配置，实时查看生成的 TypeScript 代码。',
    hint: '停止输入后会自动重新生成结果。',
  },
} satisfies Record<
  Locale,
  {
    metaTitle: string;
    metaDescription: string;
    title: string;
    description: string;
    hint: string;
  }
>;

export function getPlaygroundHead(locale: Locale) {
  const text = copy[locale];

  return {
    meta: [
      {
        title: text.metaTitle,
      },
      {
        name: 'description',
        content: text.metaDescription,
      },
    ],
  };
}

export function PlaygroundPage({ locale }: { locale: Locale }) {
  const text = copy[locale];

  return (
    <HomeLayout {...baseOptions(locale, { i18n: true })}>
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#16082a] to-[#0d0518]">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {text.title}
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {text.description}
            </p>
          </div>

          <Playground locale={locale} />

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">{text.hint}</p>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
