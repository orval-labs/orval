import { createFileRoute } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { Playground } from '@/components/playground/Playground';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/playground')({
  head: () => ({
    meta: [
      {
        title: 'Playground - Orval',
      },
      {
        name: 'description',
        content:
          'Try Orval in your browser. Generate type-safe TypeScript clients from OpenAPI specifications instantly.',
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#16082a] to-[#0d0518]">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Playground
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Try Orval in your browser. Edit the OpenAPI schema and
              configuration to see the generated TypeScript code in real-time.
            </p>
          </div>

          {/* Playground */}
          <Playground />

          {/* Footer hint */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Changes are automatically regenerated after you stop typing.
            </p>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
