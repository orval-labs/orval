import { defineConfig } from 'vite-plus';
import type { PackUserConfig } from 'vite-plus/pack';

// Shared Vite+ configuration for every published @orval/* package.
//
// `pack` (the build):
//   The default `build` produces a lean, publishable artifact (bundled,
//   tree-shaken, no JS sourcemaps) with an auto-generated dist-only `exports`
//   map — there is no `development` source condition that could leak into the
//   npm tarball (see #3216). Setting `ORVAL_PACK_DEBUG=1` (used by the `dev`
//   task) produces an unbundled, sourcemapped, non-tree-shaken build instead,
//   so breakpoints and stack traces map straight back to the original source.
//
// `run` (the task graph, replaces turbo.json):
//   `build`, `typecheck` and `test` are cached (input/output fingerprinted), so
//   `vp run` replays unchanged packages instantly. Cross-package build order and
//   cache invalidation are handled by Vite+ from the workspace dependency graph
//   in each package's `package.json` — a dependent's build reads its
//   dependencies' `dist` (an automatically-tracked input), so editing a
//   dependency invalidates its dependents. `typecheck`/`test` only need to
//   depend on the same package's `build`. Linting is a single workspace-wide
//   `vp lint` (oxlint) configured at the repo root, so there is no per-package
//   `lint` task.

const debug =
  process.env.ORVAL_PACK_DEBUG === '1' ||
  process.env.ORVAL_PACK_DEBUG === 'true';

export const definePackage = (pack: PackUserConfig = {}) =>
  defineConfig({
    pack: {
      entry: ['src/index.ts'],
      target: 'node22.18',
      platform: 'node',
      format: 'esm',
      tsconfig: 'tsconfig.build.json',
      dts: { sourcemap: true },
      exports: true,
      sourcemap: debug,
      treeshake: !debug,
      unbundle: debug,
      ...pack,
    },
    run: {
      tasks: {
        build: {
          command: 'vp pack',
          cache: true,
          input: [
            'src/**',
            'package.json',
            'tsconfig.json',
            'tsconfig.build.json',
            'vite.config.ts',
            { pattern: 'tsconfig.base.json', base: 'workspace' },
            { pattern: 'packages/vite.config.base.ts', base: 'workspace' },
          ],
          output: ['dist/**'],
        },
        typecheck: {
          command: 'tsc --noEmit',
          cache: true,
          dependsOn: ['build'],
        },
        test: {
          command: 'vitest run',
          cache: true,
          dependsOn: ['build'],
        },
        dev: {
          command: 'ORVAL_PACK_DEBUG=1 vp pack --watch',
          cache: false,
        },
        clean: {
          command: 'rimraf dist',
          cache: false,
        },
        nuke: {
          command: 'rimraf dist node_modules',
          cache: false,
        },
      },
    },
  });
