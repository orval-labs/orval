import type { Config } from 'release-it';

export default {
  npm: {
    // https://github.com/release-it/release-it/blob/main/docs/npm.md#yarn
    publishArgs: ['--registry=https://registry.npmjs.org'],
  },
  git: {
    commitMessage: 'chore(release): ${version}',
  },
  github: {
    release: true,
    draft: true,
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: 'angular',
    },
    '@release-it-plugins/workspaces': {
      publish: false,
    },
  },
} satisfies Config;
