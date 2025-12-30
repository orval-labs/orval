[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
![NPM Downloads](https://img.shields.io/npm/dm/orval?color=purple)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/orval-labs/orval/actions/workflows/tests.yaml/badge.svg)](https://github.com/orval-labs/orval/actions/workflows/tests.yaml)
[![orval](https://snyk.io/advisor/npm-package/orval/badge.svg)](https://snyk.io/advisor/npm-package/orval)
[![Gurubase](https://img.shields.io/badge/Gurubase-Ask%20Orval%20Guru-006BFF)](https://gurubase.io/g/orval)

<p align="center">
  <img src="./logo/orval-logo-horizontal.svg?raw=true" width="500" height="160" alt="orval - Restfull Client Generator" />
</p>
<h1 align="center">
  Generate Typescript clients from OpenAPI specification!
</h1>

⚠️ Actively searching for contributors, if you want to help, please contact me on [discord](https://discord.gg/6fC2sjDU7w) ⚠️

### Code Generation

`orval` generates type-safe JS clients (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

### Supported clients

`generate` models, requests, hooks, [mocks](https://mswjs.io/) and more, for these supported clients:

- [React](https://react.dev/)
- [React Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [React with swr](https://swr.vercel.app/)
- [Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview)
- [Svelte Query](https://tanstack.com/query/latest/docs/framework/svelte/overview)
- [Angular](https://angular.dev/)
- [Angular Query](https://tanstack.com/query/latest/docs/framework/angular/overview)
- [Hono](https://hono.dev/)
- [zod](https://zod.dev/)
- [native fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [mcp](https://modelcontextprotocol.io/introduction)

### Samples

You can find some samples below:

- [react app](https://github.com/orval-labs/orval/tree/master/samples/react-app)
- [react query](https://github.com/orval-labs/orval/tree/master/samples/react-query)
- [svelte query](https://github.com/orval-labs/orval/tree/master/samples/svelte-query)
- [vue query](https://github.com/orval-labs/orval/tree/master/samples/vue-query)
- [react app with swr](https://github.com/orval-labs/orval/tree/master/samples/react-app-with-swr)
- [angular app](https://github.com/orval-labs/orval/tree/master/samples/angular-app)
- [angular query](https://github.com/orval-labs/orval/tree/master/samples/angular-query)
- [hono](https://github.com/orval-labs/orval/tree/master/samples/hono)
- [next app with fetch](https://github.com/orval-labs/orval/tree/master/samples/next-app-with-fetch)
- [mcp server](https://github.com/orval-labs/orval/tree/master/samples/mcp)

### Playground

Try Orval out for yourself using our [Playground](https://orval.dev/playground) application!

## Developers

This project uses [Yarn](https://yarnpkg.com/) for package management and building. Here are the key scripts available for development:

### Prerequisites

Before using Yarn scripts, ensure you have Yarn installed. You can install it globally using npm:

```bash
npm install -g yarn
```

Alternatively, you can enable Corepack (which comes with Node.js 16.10+) to manage Yarn:

```bash
corepack enable
```

### Build Scripts

- **`yarn nuke:all`** - Completely clean your workspace by removing all build artifacts, node_modules, and cached files. Use this when you want to start fresh.

- **`yarn build`** - Build the project and make changes available to the workspace. Run this after making code changes to compile TypeScript and prepare the project for use.

### Test Scripts

- **`yarn test`** - Run unit tests in all packages.

- **`yarn update-samples`** - Generate sample outputs using the newly built version of Orval. This regenerates the sample code based on the current build.

- **`yarn test:samples`** - Run tests in the samples directory using the newly generated output from `update-samples`.

- **`yarn test:cli`** - Test that the generated output (not samples) is valid TypeScript. This validates the TypeScript compilation of the generated code.

### Development Workflow

A typical development workflow would be:

1. Make your code changes
2. Run `yarn build` to compile your changes
3. Run `yarn test` to ensure unit tests pass
4. Run `yarn update-samples` to regenerate sample outputs
5. Run `yarn test:samples` to verify samples work correctly
6. Run `yarn test:cli` to validate TypeScript compilation

If you encounter issues or want to start completely fresh:

1. Run `yarn nuke:all` to clean everything
2. Reinstall dependencies and rebuild from scratch

## Sponsors

Thank you to all our sponsors! 🍻

Support orval development by [Open Collective](https://opencollective.com/orval) and your logo will be displayed here with a link to your website.

<a href="https://opencollective.com/orval">
  <img src="https://orval.dev/images/orval-logo-horizontal.svg?raw=true" width="300" alt="Become a sponsor" />
</a>

## Backers

Thank you to all our backers! 🙏

Support us with a one-time donation and help us continue our activities on [Open Collective](https://opencollective.com/orval).

<a href="https://opencollective.com/orval">
  <img src="https://orval.dev/images/emblem.svg" width="50" height="50" alt="Backer" />
</a>
<a href="https://opencollective.com/orval">
  <img src="https://orval.dev/images/emblem.svg" width="50" height="50" alt="Backer" />
</a>
<a href="https://opencollective.com/orval">
  <img src="https://orval.dev/images/emblem.svg" width="50" height="50" alt="Backer" />
</a>

**Note:** After becoming a sponsor or backer, please contact us on [Discord](https://discord.gg/6fC2sjDU7w) to upload your logo.

## Star History

<a href="https://star-history.com/#orval-labs/orval&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=orval-labs/orval&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=orval-labs/orval&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=orval-labs/orval&type=Date" />
  </picture>
</a>

### All Thanks To Our Contributors:

<a href="https://github.com/orval-labs/orval/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=anymaniax/orval" />
</a>
