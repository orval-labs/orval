[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
![NPM Downloads](https://img.shields.io/npm/dm/orval?color=purple)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gurubase](https://img.shields.io/badge/Gurubase-Ask%20Orval%20Guru-006BFF)](https://gurubase.io/g/orval)
[![pkg.pr.new](https://pkg.pr.new/badge/orval-labs/orval)](https://pkg.pr.new/~/orval-labs/orval)

<p align="center">
  <img src="./logo/orval-logo-horizontal.svg?raw=true" width="500" height="160" alt="orval - Restfull Client Generator" />
</p>
<h1 align="center">
  Generate Typescript clients from OpenAPI specification!
</h1>

### Code Generation

`orval` generates type-safe JS clients (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

> [!IMPORTANT]
> Version [8.0.0+](https://orval.dev/docs/versions/v8) comes with a lot of improvements and changes please see the [Migration Guide](https://orval.dev/docs/versions/v8)

### Supported clients

`generate` models, requests, hooks, [mocks](https://mswjs.io/) and more, for these supported clients:

- [React](https://react.dev/)
- [React Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [React with swr](https://swr.vercel.app/)
- [Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview)
- [Svelte Query](https://tanstack.com/query/latest/docs/framework/svelte/overview)
- [Solid Query](https://tanstack.com/query/latest/docs/framework/solid/overview)
- [SolidStart](https://start.solidjs.com/)
- [Angular](https://angular.dev/)
- [Angular Query](https://tanstack.com/query/latest/docs/framework/angular/overview)
- [Hono](https://hono.dev/)
- [zod](https://zod.dev/)
- [Effect](https://effect.website/)
- [native fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [mcp](https://modelcontextprotocol.io/introduction)

### Samples

You can find some samples below:

- [react app](https://github.com/orval-labs/orval/tree/master/samples/react-app)
- [react query](https://github.com/orval-labs/orval/tree/master/samples/react-query)
- [svelte query](https://github.com/orval-labs/orval/tree/master/samples/svelte-query)
- [vue query](https://github.com/orval-labs/orval/tree/master/samples/vue-query)
- [solid query](https://github.com/orval-labs/orval/tree/master/samples/solid-query)
- [solid start](https://github.com/orval-labs/orval/tree/master/samples/solid-start)
- [react app with swr](https://github.com/orval-labs/orval/tree/master/samples/react-app-with-swr)
- [angular app](https://github.com/orval-labs/orval/tree/master/samples/angular-app)
- [angular query](https://github.com/orval-labs/orval/tree/master/samples/angular-query)
- [hono](https://github.com/orval-labs/orval/tree/master/samples/hono)
- [swr with effect](https://github.com/orval-labs/orval/tree/master/samples/swr-with-effect)
- [next app with fetch](https://github.com/orval-labs/orval/tree/master/samples/next-app-with-fetch)
- [mcp server](https://github.com/orval-labs/orval/tree/master/samples/mcp)

### Playground

Try Orval out for yourself using our [Playground](https://orval.dev/playground) application!

### Docker

Orval 8+ requires Node.js 22.18 or newer. Projects on an older Node LTS can run code generation with the official Docker image.

**Basic usage**

```bash
# macOS / Linux
docker run --rm -v "$(pwd):/app" -w /app ghcr.io/orval-labs/orval

# Windows Git Bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app ghcr.io/orval-labs/orval

# Windows CMD
cd /d "C:\path\to\your-project"
docker run --rm -v "%cd%:/app" -w /app ghcr.io/orval-labs/orval

# Windows PowerShell
cd "C:\path\to\your-project"
docker run --rm -v "${PWD}:/app" -w /app ghcr.io/orval-labs/orval
```

**Local API (`localhost` → `host.docker.internal`)**

```bash
# macOS / Linux
docker run --rm -v "$(pwd):/app" -w /app -e ORVAL_SWAGGER_URL="https://host.docker.internal:7142/swagger/v1/swagger.json" -e NODE_TLS_REJECT_UNAUTHORIZED=0 ghcr.io/orval-labs/orval --config ./orval.config.ts

# Linux (native Docker)
docker run --rm --add-host=host.docker.internal:host-gateway -v "$(pwd):/app" -w /app -e ORVAL_SWAGGER_URL="https://host.docker.internal:7142/swagger/v1/swagger.json" -e NODE_TLS_REJECT_UNAUTHORIZED=0 ghcr.io/orval-labs/orval --config ./orval.config.ts

# Windows Git Bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app -e ORVAL_SWAGGER_URL="https://host.docker.internal:7142/swagger/v1/swagger.json" -e NODE_TLS_REJECT_UNAUTHORIZED=0 ghcr.io/orval-labs/orval --config ./orval.config.ts

# Windows CMD
cd /d "C:\path\to\your-project"
docker run --rm -v "%cd%:/app" -w /app -e "ORVAL_SWAGGER_URL=https://host.docker.internal:7142/swagger/v1/swagger.json" -e "NODE_TLS_REJECT_UNAUTHORIZED=0" ghcr.io/orval-labs/orval --config ./orval.config.ts

# Windows PowerShell
cd "C:\path\to\your-project"
docker run --rm -v "${PWD}:/app" -w /app -e ORVAL_SWAGGER_URL="https://host.docker.internal:7142/swagger/v1/swagger.json" -e NODE_TLS_REJECT_UNAUTHORIZED=0 ghcr.io/orval-labs/orval --config ./orval.config.ts
```

Replace `ghcr.io/orval-labs/orval` with `orval:local` when testing locally before the official image is published. See the [installation docs](https://orval.dev/docs/installation#docker) for details.

## A note about AI

First of all, we do not reject the use of AI agents outright. That said, please do not submit AI-generated output in a PR without reviewing it yourself. Every change must have a clear intent and purpose — do not submit changes you cannot explain in your own words. Making the effort to understand orval's codebase, TypeScript, and API clients beforehand, and reviewing what AI produces, is the contributor's responsibility, not the reviewer's. Finally, we will continue to welcome new contributors and actively support you through review and iteration.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Developers

This project uses [Bun](https://bun.sh/) for package management and building. Bun [install guide](https://bun.sh/docs/installation).

### Build Scripts

- **`vp run nuke:all`** - Completely clean your workspace by removing all build artifacts, node_modules, and cached files. Use this when you want to start fresh.

- **`vp run build`** - Build the project and make changes available to the workspace. Run this after making code changes to compile TypeScript and prepare the project for use.

- **`vp run typecheck`** - Run TypeScript type checking across all packages.

### Test Scripts

- **`vp run test`** - Run unit tests in all packages.

- **`vp run update-samples`** - Generate sample outputs using the newly built version of Orval. This regenerates the sample code based on the current build.

- **`vp run test:samples`** - Run tests in the samples directory using the newly generated output from `update-samples`.

- **`vp run test:snapshots`** - Run snapshot tests to verify generated sample outputs match the committed snapshots. Fails if any generated file differs from its snapshot.

- **`vp run test:snapshots:update`** - Regenerate snapshot files to match the current generated output. Run this after `vp run update-samples` when the generated output has intentionally changed.

- **`vp run test:cli`** - Test that the generated output (not samples) is valid TypeScript. This validates the TypeScript compilation of the generated code.

### Development Workflow

A typical development workflow would be:

1. Make your code changes
2. Run `vp run build` to compile your changes
3. Run `vp run typecheck` to verify package typings
4. Run `vp run lint` to catch lint issues early
5. Run `vp run test` to run unit tests in packages
6. Run `vp run test:snapshots` to verify generated output matches snapshots

If step 6 fails because the generated output has intentionally changed, run `vp run test:snapshots:update` to update the snapshots.

If you encounter issues or want to start completely fresh:

1. Run `vp run nuke:all` to clean everything
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
<a href="https://github.com/tatsuya-asami">
  <img src="https://github.com/tatsuya-asami.png" width="50" height="50" alt="tatsuya-asami" />
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
