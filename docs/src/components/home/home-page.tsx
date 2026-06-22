import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { ParticleNetwork } from '@/components/particle-network';
import type { Locale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';
import type { Sponsor } from '@/lib/sponsors';

interface HomeSponsors {
  goldSponsors: Sponsor[];
  silverSponsors: Sponsor[];
  backers: Sponsor[];
}

interface HomePageProps {
  locale: Locale;
  sponsors: HomeSponsors;
}

const frameworks = [
  { name: 'React Query', icon: '⚛️' },
  { name: 'Vue Query', icon: '💚' },
  { name: 'Svelte Query', icon: '🔥' },
  { name: 'Solid Query', icon: '💠' },
  { name: 'SolidStart', icon: '🏁' },
  { name: 'Angular', icon: '🅰️' },
  { name: 'SWR', icon: '🔄' },
  { name: 'Axios', icon: '📡' },
  { name: 'Fetch', icon: '🌐' },
  { name: 'MSW', icon: '🎭' },
  { name: 'Zod', icon: '🛡️' },
  { name: 'Hono', icon: '🔥' },
  { name: 'MCP', icon: '🤖' },
];

const inputCode = `openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Pet'
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string`;

const outputCode = `import { useQuery } from '@tanstack/react-query';

export interface Pet {
  id?: number;
  name?: string;
}

export const useListPets = () => {
  return useQuery({
    queryKey: ['listPets'],
    queryFn: async () => {
      const response = await fetch('/pets');
      return response.json() as Promise<Pet[]>;
    },
  });
};

// Usage in your component
const { data: pets } = useListPets();`;

const zhOutputCode = `import { useQuery } from '@tanstack/react-query';

export interface Pet {
  id?: number;
  name?: string;
}

export const useListPets = () => {
  return useQuery({
    queryKey: ['listPets'],
    queryFn: async () => {
      const response = await fetch('/pets');
      return response.json() as Promise<Pet[]>;
    },
  });
};

// 在组件中使用
const { data: pets } = useListPets();`;

const copy = {
  en: {
    badge: 'v8 is now available',
    headlineTop: 'OpenAPI to',
    headlineBottom: 'TypeScript Magic',
    hero: 'Transform your OpenAPI specs into type-safe clients, mocks, and validators. Stop writing boilerplate. Start shipping features.',
    getStarted: 'Get Started',
    github: 'View on GitHub',
    codeTitle: 'From Spec to Code in Seconds',
    codeDescription:
      'Your OpenAPI specification becomes fully typed, production-ready code.',
    featuresTitle: 'Why Developers Love Orval',
    featuresDescription:
      'Built by developers, for developers. Every feature designed to save you time.',
    frameworksTitle: 'Works With Your Stack',
    frameworksDescription: 'First-class support for the tools you already use.',
    sponsorsTitle: 'Thanks for the Support!',
    sponsorsDescription:
      'Orval is made possible by our amazing sponsors and backers.',
    sponsors: 'Sponsors',
    backers: 'Backers',
    openCollective: 'Support us on Open Collective',
    githubSponsors: 'Or sponsor the maintainers on GitHub',
    ctaTitle: 'Ready to Transform Your API Workflow?',
    ctaDescription: 'Join thousands of developers who ship faster with Orval.',
    readDocs: 'Read the Docs',
    starGithub: 'Star on GitHub',
    footer: 'Built by the Orval community',
    docsHref: '/docs',
    outputCode,
    features: [
      {
        title: 'Type Safety',
        description:
          'End-to-end TypeScript types generated from your OpenAPI spec. No more runtime surprises.',
        icon: '🔒',
      },
      {
        title: 'Framework Native',
        description:
          'Generate hooks for React Query, SWR, Angular, Vue, Svelte, and Solid. Use what you know.',
        icon: '⚡',
      },
      {
        title: 'Mock Ready',
        description:
          'Auto-generate MSW handlers with Faker.js data. Test without a backend.',
        icon: '🎭',
      },
    ],
  },
  zh: {
    badge: 'v8 已发布',
    headlineTop: '从 OpenAPI 到',
    headlineBottom: 'TypeScript 代码',
    hero: '把 OpenAPI 规范转换为类型安全的客户端、Mock 和校验器。减少样板代码，把时间花在业务功能上。',
    getStarted: '开始使用',
    github: '查看 GitHub',
    codeTitle: '几秒内从规范生成代码',
    codeDescription:
      '你的 OpenAPI 规范会变成完整类型、可用于生产的 TypeScript 代码。',
    featuresTitle: '为什么开发者喜欢 Orval',
    featuresDescription:
      '由开发者构建，也为开发者服务。每个能力都围绕减少重复工作设计。',
    frameworksTitle: '适配你的技术栈',
    frameworksDescription: '优先支持你已经在使用的框架和工具。',
    sponsorsTitle: '感谢支持',
    sponsorsDescription: 'Orval 离不开赞助者和社区支持者的帮助。',
    sponsors: '赞助者',
    backers: '支持者',
    openCollective: '在 Open Collective 支持我们',
    githubSponsors: '也可以在 GitHub 赞助维护者',
    ctaTitle: '准备改进你的 API 工作流了吗？',
    ctaDescription: '加入使用 Orval 更快交付的开发者社区。',
    readDocs: '阅读文档',
    starGithub: '在 GitHub 点星',
    footer: '由 Orval 社区构建',
    docsHref: '/zh/docs',
    outputCode: zhOutputCode,
    features: [
      {
        title: '类型安全',
        description:
          '从 OpenAPI 规范生成端到端 TypeScript 类型，减少运行时意外。',
        icon: '🔒',
      },
      {
        title: '框架原生',
        description:
          '生成 React Query、SWR、Angular、Vue、Svelte 和 Solid 等框架的原生调用方式。',
        icon: '⚡',
      },
      {
        title: 'Mock 就绪',
        description:
          '自动生成 MSW handlers 和 Faker.js 数据，不依赖真实后端也能开发和测试。',
        icon: '🎭',
      },
    ],
  },
} satisfies Record<
  Locale,
  {
    badge: string;
    headlineTop: string;
    headlineBottom: string;
    hero: string;
    getStarted: string;
    github: string;
    codeTitle: string;
    codeDescription: string;
    featuresTitle: string;
    featuresDescription: string;
    frameworksTitle: string;
    frameworksDescription: string;
    sponsorsTitle: string;
    sponsorsDescription: string;
    sponsors: string;
    backers: string;
    openCollective: string;
    githubSponsors: string;
    ctaTitle: string;
    ctaDescription: string;
    readDocs: string;
    starGithub: string;
    footer: string;
    docsHref: string;
    outputCode: string;
    features: Array<{
      title: string;
      description: string;
      icon: string;
    }>;
  }
>;

export function HomePage({ locale, sponsors }: HomePageProps) {
  const t = copy[locale];
  const { goldSponsors, silverSponsors, backers } = sponsors;
  const allSponsors = [...goldSponsors, ...silverSponsors];

  return (
    <HomeLayout {...baseOptions(locale, { i18n: true })}>
      <div className="min-h-screen overflow-x-hidden">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0518] -z-10" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6F40C9]/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#F79D53]/10 rounded-full blur-3xl -z-10" />

          <div className="absolute inset-0 -z-5">
            <ParticleNetwork className="w-full h-full" particleCount={100} />
          </div>

          <div className="max-w-6xl mx-auto px-4 py-24 md:py-32">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
              <div className="relative flex-shrink-0 hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-r from-[#6F40C9] to-[#F79D53] opacity-20 blur-3xl rounded-full scale-110" />
                <img
                  src="/images/emblem.svg"
                  alt="Orval"
                  className="relative w-[280px] h-[280px] xl:w-[350px] xl:h-[350px]"
                />
              </div>

              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6F40C9]/10 border border-[#6F40C9]/20 text-[#6F40C9] text-sm mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6F40C9] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6F40C9]" />
                  </span>
                  {t.badge}
                </div>

                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                  <span className="text-white">{t.headlineTop}</span>
                  <br />
                  <span className="bg-gradient-to-r from-[#6F40C9] via-[#9B6DD7] to-[#F79D53] bg-clip-text text-transparent">
                    {t.headlineBottom}
                  </span>
                </h1>

                <p
                  className="text-lg md:text-xl text-gray-200 font-light max-w-2xl lg:mx-0 mx-auto mb-10"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {t.hero}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-12">
                  <a
                    href={t.docsHref}
                    className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
                  >
                    {t.getStarted}
                  </a>
                  <a
                    href="https://github.com/orval-labs/orval"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                  >
                    {t.github}
                  </a>
                </div>

                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-black/40 border border-white/10 font-mono text-sm">
                  <span className="text-gray-500">$</span>
                  <span className="text-gray-300">bun add -d orval</span>
                  <button
                    type="button"
                    aria-label="Copy install command"
                    className="text-gray-500 hover:text-white transition-colors"
                    onClick={() =>
                      navigator.clipboard.writeText('bun add -d orval')
                    }
                  >
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-[#0d0518] overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 overflow-hidden">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {t.codeTitle}
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                {t.codeDescription}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 md:gap-8 pt-4">
              <div className="relative min-w-0">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-[#6F40C9] text-white text-xs font-medium rounded z-10">
                  petstore.yaml
                </div>
                <div className="rounded-xl bg-black/60 border border-white/10 overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0 [&_pre]:!text-sm [&_pre]:!leading-relaxed">
                  <DynamicCodeBlock lang="yaml" code={inputCode} />
                </div>
              </div>

              <div className="relative min-w-0">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-[#F79D53] text-white text-xs font-medium rounded z-10">
                  petstore.ts
                </div>
                <div className="rounded-xl bg-black/60 border border-white/10 overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0 [&_pre]:!text-sm [&_pre]:!leading-relaxed">
                  <DynamicCodeBlock lang="typescript" code={t.outputCode} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-b from-[#0d0518] to-[#16082a]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {t.featuresTitle}
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                {t.featuresDescription}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {t.features.map((feature) => (
                <div
                  key={feature.title}
                  className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#6F40C9]/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#6F40C9]/10 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-[#16082a]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {t.frameworksTitle}
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                {t.frameworksDescription}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {frameworks.map((fw) => (
                <div
                  key={fw.name}
                  className="px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:border-[#6F40C9]/50 transition-colors flex items-center gap-2"
                >
                  <span className="text-xl">{fw.icon}</span>
                  <span className="text-white font-medium">{fw.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-b from-[#16082a] to-[#1a0a2e]">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {t.sponsorsTitle}
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                {t.sponsorsDescription}
              </p>
            </div>

            {allSponsors.length > 0 && (
              <div className="mb-10">
                <h3 className="text-lg font-semibold text-gray-300 mb-6 text-center">
                  {t.sponsors}
                </h3>
                <div className="flex flex-wrap justify-center gap-4">
                  {allSponsors.map((sponsor) => (
                    <a
                      key={sponsor.profile}
                      href={sponsor.profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                      title={sponsor.name}
                    >
                      <img
                        src={sponsor.image}
                        alt={sponsor.name}
                        className="w-16 h-16 rounded-full border-2 border-[#6F40C9]/50 group-hover:border-[#6F40C9] transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {backers.length > 0 && (
              <div className="mb-10">
                <h3 className="text-lg font-semibold text-gray-300 mb-6 text-center">
                  {t.backers}
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {backers.map((backer) => (
                    <a
                      key={backer.profile}
                      href={backer.profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                      title={backer.name}
                    >
                      <img
                        src={backer.image}
                        alt={backer.name}
                        className="w-10 h-10 rounded-full border border-white/20 group-hover:border-white/50 transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-6 items-center">
              <a
                href="https://opencollective.com/orval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
              >
                {t.openCollective}
              </a>

              <div className="text-center">
                <p className="text-gray-400 text-sm mb-4">{t.githubSponsors}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    { login: 'anymaniax', name: 'Victor' },
                    { login: 'melloware', name: 'Melloware' },
                    { login: 'soartec-lab', name: 'Soartec Lab' },
                  ].map((maintainer) => (
                    <a
                      key={maintainer.login}
                      href={`https://github.com/sponsors/${maintainer.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 hover:border-pink-500/50 transition-colors"
                    >
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 text-pink-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      {maintainer.login}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-gradient-to-b from-[#1a0a2e] to-[#0d0518]">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              {t.ctaTitle}
            </h2>
            <p className="text-xl text-gray-400 mb-10">{t.ctaDescription}</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href={t.docsHref}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
              >
                {t.readDocs}
              </a>
              <a
                href="https://github.com/orval-labs/orval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-lg hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                {t.starGithub}
              </a>
            </div>
          </div>
        </section>

        <footer className="py-8 bg-[#0d0518] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>{t.footer}</p>
          </div>
        </footer>
      </div>
    </HomeLayout>
  );
}
