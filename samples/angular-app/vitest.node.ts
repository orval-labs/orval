import path from 'node:path';

import { defineConfig } from 'vite-plus';

import pkg from './package.json' with { type: 'json' };

const groups = path.resolve(import.meta.dirname, 'src/api/artifact-groups');

// Runs outside the Angular test builder, in plain Node, so nothing loads
// Angular unless the code under test imports it.
export default defineConfig({
  resolve: {
    alias: {
      '@artifact-groups/schemas': path.join(groups, 'schemas/index.ts'),
      '@artifact-groups/faker': path.join(groups, 'faker/index.faker.ts'),
    },
  },
  test: {
    name: { label: `${pkg.name}:node` },
    environment: 'node',
    include: ['artifact-groups.node.spec.ts'],
  },
});
