import { createFileRoute, Link } from '@tanstack/react-router';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { ParticleNetwork } from '@/components/particle-network';
import { baseOptions } from '@/lib/layout.shared';
import { getSponsors } from '@/lib/sponsors';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const sponsors = await getSponsors();
    return { sponsors };
  },
});

const frameworks = [
  { name: 'React Query', icon: '⚛️' },
  { name: 'Vue Query', icon: '💚' },
  { name: 'Svelte Query', icon: '🔥' },
  { name: 'Solid Query', icon: '💠' },
  { name: 'Angular', icon: '🅰️' },
  { name: 'SWR', icon: '🔄' },
  { name: 'Axios', icon: '📡' },
  { name: 'Fetch', icon: '🌐' },
  { name: 'MSW', icon: '🎭' },
  { name: 'Zod', icon: '🛡️' },
  { name: 'Hono', icon: '🔥' },
  { name: 'MCP', icon: '🤖' },
];

const features = [
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

function Home() {
  const { sponsors } = Route.useLoaderData();
  const { goldSponsors, silverSponsors, backers } = sponsors;
  const allSponsors = [...goldSponsors, ...silverSponsors];

  return (
    <HomeLayout {...baseOptions()}>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-visible">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0518] -z-10" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6F40C9]/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#F79D53]/10 rounded-full blur-3xl -z-10" />

          {/* Interactive particle network */}
          <div className="absolute inset-0 -z-5">
            <ParticleNetwork className="w-full h-full" particleCount={100} />
          </div>

          <div className="max-w-6xl mx-auto px-4 py-24 md:py-32">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
              {/* Logo */}
              <div className="relative flex-shrink-0 hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-r from-[#6F40C9] to-[#F79D53] opacity-20 blur-3xl rounded-full scale-110" />
                <img
                  src="/images/emblem.svg"
                  alt="Orval"
                  className="relative w-[280px] h-[280px] xl:w-[350px] xl:h-[350px]"
                />
              </div>

              {/* Content */}
              <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6F40C9]/10 border border-[#6F40C9]/20 text-[#6F40C9] text-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6F40C9] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6F40C9]"></span>
                </span>
                v8 is now available
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                <span className="text-white">OpenAPI to</span>
                <br />
                <span className="bg-gradient-to-r from-[#6F40C9] via-[#9B6DD7] to-[#F79D53] bg-clip-text text-transparent">
                  TypeScript Magic
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-200 font-light max-w-2xl lg:mx-0 mx-auto mb-10" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Transform your OpenAPI specs into type-safe clients, mocks, and
                validators. Stop writing boilerplate. Start shipping features.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-12">
                <Link
                  to="/docs/$"
                  params={{ _splat: '' }}
                  className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
                >
                  Get Started
                </Link>
                <a
                  href="https://github.com/orval-labs/orval"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                >
                  View on GitHub
                </a>
              </div>

              {/* Install command */}
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-black/40 border border-white/10 font-mono text-sm">
                <span className="text-gray-500">$</span>
                <span className="text-gray-300">bun add -d orval</span>
                <button
                  className="text-gray-500 hover:text-white transition-colors"
                  onClick={() =>
                    navigator.clipboard.writeText('bun add -d orval')
                  }
                >
                  <svg
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

        {/* Code Transform Section */}
        <section className="py-20 bg-[#0d0518]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                From Spec to Code in Seconds
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Your OpenAPI specification becomes fully typed, production-ready
                code.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 md:gap-8 pt-4">
              {/* Input */}
              <div className="relative">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-[#6F40C9] text-white text-xs font-medium rounded z-10">
                  petstore.yaml
                </div>
                <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0">
                  <DynamicCodeBlock lang="yaml" code={inputCode} />
                </div>
              </div>

              {/* Output */}
              <div className="relative">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-[#F79D53] text-white text-xs font-medium rounded z-10">
                  petstore.ts
                </div>
                <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0">
                  <DynamicCodeBlock lang="typescript" code={outputCode} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gradient-to-b from-[#0d0518] to-[#16082a]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Why Developers Love Orval
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Built by developers, for developers. Every feature designed to
                save you time.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature) => (
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

        {/* Frameworks Section */}
        <section className="py-20 bg-[#16082a]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Works With Your Stack
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                First-class support for the tools you already use.
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

        {/* Sponsors Section */}
        <section className="py-20 bg-gradient-to-b from-[#16082a] to-[#1a0a2e]">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Thanks for the Support! 🍻
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Orval is made possible by our amazing sponsors and backers.
              </p>
            </div>

            {/* Sponsors */}
            {allSponsors.length > 0 && (
              <div className="mb-10">
                <h3 className="text-lg font-semibold text-gray-300 mb-6 text-center">
                  Sponsors
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

            {/* Backers */}
            {backers.length > 0 && (
              <div className="mb-10">
                <h3 className="text-lg font-semibold text-gray-300 mb-6 text-center">
                  Backers
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

            {/* Support buttons */}
            <div className="flex flex-col gap-6 items-center">
              <a
                href="https://opencollective.com/orval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
              >
                Support us on Open Collective
              </a>

              {/* GitHub Sponsors */}
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-4">
                  Or sponsor the maintainers on GitHub
                </p>
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

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-b from-[#1a0a2e] to-[#0d0518]">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your API Workflow?
            </h2>
            <p className="text-xl text-gray-400 mb-10">
              Join thousands of developers who ship faster with Orval.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/docs/$"
                params={{ _splat: '' }}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-[#6F40C9] to-[#8B5AC9] text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#6F40C9]/25"
              >
                Read the Docs
              </Link>
              <a
                href="https://github.com/orval-labs/orval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-lg hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-[#0d0518] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>Built with ❤️ by the Orval community</p>
          </div>
        </footer>
      </div>
    </HomeLayout>
  );
}
