import type { Config } from 'release-it';

export default {
  npm: {
    // version is already bumped by @release-it-plugins/workspaces
    allowSameVersion: true,
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
      workspaces: ['packages/*'],
    },
  },
  hooks: {
    'before:init': ['yarn run build', 'yarn run test:ci'],
    'after:bump': ['yarn run build --force', 'yarn run update-samples'],
  },
} satisfies Config;
