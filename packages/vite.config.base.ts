import { defineConfig } from 'vite-plus';
import type { PackUserConfig } from 'vite-plus/pack';

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
      sourcemap: false,
      treeshake: true,
      unbundle: false,
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
          command: 'vp pack --watch --unbundle --sourcemap --no-treeshake',
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
