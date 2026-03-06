# Samples

This directory contains sample projects demonstrating orval with various frameworks and configurations. Each sample is a standalone project within the monorepo workspace.

## Adding a Sample

Create a directory under `samples/` with the four files described below, then run `yarn install` to link `orval@workspace`. The sample does not need to be directly under `samples/` and can be under `samples/<GROUP NAME>/`.

```text
samples/
└── <sample-name>/
    ├── package.json
    ├── orval.config.ts
    ├── vitest.snapshots.ts
    └── api-generation.spec.ts
```

### `package.json`

Update `<ORVAL OUTPUT DIR>`

```jsonc
{
  // other props omitted...
  "scripts": {
    "generate-api": "orval",
    "test:snapshots": "vitest run --config vitest.snapshots.ts",
    "test:snapshots:update": "yarn test:snapshots --update",
    "clean": "rimraf .turbo dist <ORVAL OUTPUT DIR>",
    "nuke": "rimraf .turbo dist node_modules <ORVAL OUTPUT DIR>",
  },
  "devDependencies": {
    "orval": "workspace:*",
    "rimraf": "catalog:",
    "vitest": "catalog:",
  },
}
```

> [!IMPORTANT]
> Remember to run `yarn install` to link `orval@workspace`.

### `orval.config.ts`

Update paths.

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  <PROJECT_NAME>: {
    input: './<OPENAPI SPEC FILE>',
    output: {
      // DO NOT PUT OTHER FILES IN THE OUTPUT DIR
      target: './<OUTPUT DIR>',

      // keep these
      prettier: true,
      clean: true,
    },
  },
});
```

### `vitest.snapshots.ts`

No changes needed.

```ts
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    name: { label: pkg.name },
    include: ['api-generation.spec.ts'],
    silent: 'passed-only',
  },
});
```

### `api-generation.spec.ts`

Update the paths.

- import path to **snapshot-testing**
- `dirs` to point to `<ORVAL OUTPUT DIR>`
- `rootDir` to point repo root

```ts
import path from 'node:path';
import { describeApiGenerationSnapshots } from '../../test-utils/snapshot-testing';

await describeApiGenerationSnapshots({
  dirs: [path.resolve(import.meta.dirname, '<PATH>', '<TO>', '<OUTPUT>')],
  snapshotsDir: path.resolve(import.meta.dirname, '__snapshots__'),
  rootDir: path.resolve(import.meta.dirname, '..', '..'), // should match the `..` in the import above
});
```
