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
        'build:release': {
          command: 'vp pack',
          cache: true,
          dependsOn: ['clean'],
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
        'build:debug': {
          command: 'vp pack --unbundle --sourcemap --no-treeshake --no-minify',
          cache: false,
        },
        typecheck: {
          command: 'tsc --noEmit',
          cache: true,
          dependsOn: ['build:release'],
        },
        test: {
          command: 'vitest run',
          cache: true,
          dependsOn: ['build:release'],
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
