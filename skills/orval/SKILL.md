---
name: orval
description: Generate type-safe API clients, TanStack Query/SWR hooks, Zod schemas, MSW mocks, Hono server handlers, MCP servers, and SolidStart actions from OpenAPI specs using Orval. Covers all clients (React/Vue/Svelte/Solid/Angular Query, Fetch, Axios), custom HTTP mutators, authentication patterns, NDJSON streaming, programmatic API, and advanced configuration.
---

# Orval - OpenAPI to TypeScript Code Generator

Orval generates type-safe TypeScript clients, hooks, schemas, mocks, and server handlers from OpenAPI v3/Swagger v2 specifications.

## Quick Start

### Installation

```bash
npm install orval -D
# or yarn add orval -D
# or pnpm add orval -D
# or bun add orval -D
```

### Minimal Configuration

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      target: './src/api/petstore.ts',
      schemas: './src/api/model',
      client: 'react-query',
    },
  },
});
```

### Run

```bash
npx orval
npx orval --config ./orval.config.ts
npx orval --project petstore
npx orval --watch
```

## Choosing Your Setup

### Client Selection Guide

| Use Case | Client | httpClient | Notes |
|----------|--------|------------|-------|
| React with server state | `react-query` | `fetch` or `axios` | TanStack Query hooks |
| Vue 3 with server state | `vue-query` | `fetch` or `axios` | TanStack Query for Vue |
| Svelte with server state | `svelte-query` | `fetch` or `axios` | TanStack Query for Svelte |
| SolidJS standalone app | `solid-query` | `fetch` or `axios` | TanStack Query for Solid |
| SolidStart full-stack | `solid-start` | native fetch | Uses `query()`/`action()` primitives |
| Angular with signals | `angular-query` | `angular` | Injectable functions, signal reactivity |
| Angular traditional | `angular` | — | HttpClient services |
| React with SWR | `swr` | `fetch` or `axios` | Vercel SWR hooks |
| Lightweight / Edge | `fetch` | — | Zero dependencies, works everywhere |
| Node.js / existing Axios | `axios-functions` | — | Factory functions (default) |
| Axios with DI | `axios` | — | Injectable Axios instance |
| Validation only | `zod` | — | Zod schemas, no HTTP client |
| Backend API server | `hono` | — | Hono handlers with Zod validation |
| AI agent tools | `mcp` | — | Model Context Protocol servers |

### Mode Selection Guide

- **`single`** — Everything in one file. Best for small APIs.
- **`split`** — Separate files: `petstore.ts`, `petstore.schemas.ts`, `petstore.msw.ts`. Good for medium APIs.
- **`tags`** — One file per OpenAPI tag + shared schemas. Organizes by domain.
- **`tags-split`** — Folder per tag with split files. Best for large APIs. Recommended.

### httpClient Option

For `react-query`, `vue-query`, `svelte-query`, and `swr` clients:

```ts
output: {
  client: 'react-query',
  httpClient: 'fetch',  // 'fetch' (default) | 'axios'
}
```

For `angular-query`:

```ts
output: {
  client: 'angular-query',
  httpClient: 'angular',  // Uses Angular HttpClient
}
```

## Configuration Reference

### Config Structure

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  [projectName]: {
    input: InputOptions,
    output: OutputOptions,
    hooks: HooksOptions,
  },
});
```

Multiple projects can share the same config file with different input/output settings.

### Input Options

```ts
input: {
  target: './spec.yaml',              // Path or URL to OpenAPI spec (required)
  override: {
    transformer: './transform.js',    // Transform spec before generation
  },
  filters: {
    mode: 'include',                  // 'include' | 'exclude'
    tags: ['pets', /health/],         // Filter by OpenAPI tags
    schemas: ['Pet', /Error/],        // Filter by schema names
  },
  parserOptions: {
    headers: [                        // Auth headers for remote spec URLs
      {
        domains: ['api.example.com'],
        headers: {
          Authorization: 'Bearer YOUR_TOKEN',
          'X-API-Key': 'your-api-key',
        },
      },
    ],
  },
}
```

### Output Options

```ts
output: {
  target: './src/api/endpoints.ts',     // Output path (required)
  client: 'react-query',               // Client type (see table above)
  httpClient: 'fetch',                  // 'fetch' (default) | 'axios' | 'angular'
  mode: 'tags-split',                   // 'single' | 'split' | 'tags' | 'tags-split'
  schemas: './src/api/model',           // Output path for model types
  operationSchemas: './src/api/params', // Separate path for operation-derived types
  workspace: 'src/',                    // Base folder for all files
  fileExtension: '.ts',                 // Custom file extension
  namingConvention: 'camelCase',        // File naming: camelCase | PascalCase | snake_case | kebab-case
  indexFiles: true,                     // Generate index.ts barrel files
  clean: true,                          // Clean output before generating
  prettier: true,                       // Format with Prettier
  biome: true,                          // Format with Biome
  headers: true,                        // Generate header parameters
  baseUrl: '/api/v2',                   // API base URL
  // or from spec:
  // baseUrl: { getBaseUrlFromSpecification: true, index: 0, variables: { environment: 'api.dev' } },
  mock: true,                           // Generate MSW handlers (boolean or config object)
  docs: true,                           // Generate TypeDoc documentation
  // docs: { configPath: './typedoc.config.mjs' },
  allParamsOptional: true,              // Make all params optional (except path params)
  urlEncodeParameters: true,            // URL-encode path/query parameters
  optionsParamRequired: false,          // Make options parameter required
  propertySortOrder: 'Specification',   // 'Alphabetical' | 'Specification'
  tsconfig: './tsconfig.json',          // Custom tsconfig path
  override: { ... },                    // Advanced overrides (see below)
}
```

### Multiple API Specs

```ts
export default defineConfig({
  petstoreV1: {
    input: { target: './specs/v1.yaml' },
    output: { target: 'src/api/v1', client: 'react-query' },
  },
  petstoreV2: {
    input: { target: './specs/v2.yaml' },
    output: { target: 'src/api/v2', client: 'react-query' },
  },
});
```

### Filter Endpoints

```ts
input: {
  target: './spec.yaml',
  filters: {
    mode: 'include',
    tags: ['pets'],
  },
}
```

## Detailed Guides

When the user's question involves a specific topic below, read the corresponding file from this skill's directory.

| Topic | File | Load when user asks about... |
|-------|------|-----|
| TanStack Query / SWR | [tanstack-query.md](tanstack-query.md) | React Query, Vue Query, Svelte Query, Solid Query, SWR, query hooks, invalidation, infinite queries, suspense, prefetch |
| Angular | [angular.md](angular.md) | Angular Query, Angular HttpClient, signals, inject functions, Angular services, providedIn |
| SolidStart | [solid-start.md](solid-start.md) | SolidStart, @solidjs/router, query(), action(), createAsync, revalidate |
| Custom HTTP / Auth | [custom-http-clients.md](custom-http-clients.md) | Custom mutator, authentication, tokens, interceptors, custom fetch/axios, baseURL, hook-based mutator |
| Zod Validation | [zod-validation.md](zod-validation.md) | Zod schemas, validation, runtime validation, coerce, strict, preprocess |
| Mocking / MSW | [mocking-msw.md](mocking-msw.md) | MSW mocks, testing, test setup, faker, Vitest, mock handlers, useExamples |
| Hono Server | [hono.md](hono.md) | Hono handlers, zValidator, composite routes, context types, server-side generation |
| Advanced Config | [advanced-config.md](advanced-config.md) | Type generation, enums, per-operation overrides, FormData, JSDoc, params serializer, full example |
| Tooling / Workflow | [tooling-workflow.md](tooling-workflow.md) | Programmatic API, transformers, hooks, NDJSON streaming, MCP, afterAllFilesWrite |

## OpenAPI Specification Best Practices

1. **Use unique `operationId`** for every operation — Orval uses these for function and hook names
2. **Define reusable schemas** in `components/schemas` — reduces duplication in generated types
3. **Use tags** to group operations — works with `tags` and `tags-split` modes
4. **Define response types** for all operations — enables full type safety
5. **Mark required fields** — affects optional/required in generated TypeScript interfaces
6. **Use `x-enumNames`** for numeric enums — generates readable const names
7. **Provide `example` values** — used by mock generation when `useExamples: true`
8. **Use `application/x-ndjson`** content type for streaming endpoints — enables typed NDJSON generation

## CLI Reference

```bash
orval                                    # Generate using auto-discovered config
orval --config ./api/orval.config.ts     # Specify config file
orval --project petstore                 # Run specific project(s)
orval --watch                            # Watch mode
orval --watch ./src                      # Watch specific directory
orval --clean                            # Clean generated files
orval --prettier                         # Format with Prettier
orval --biome                            # Format with Biome
orval --tsconfig ./src/tsconfig.json     # Custom tsconfig path
orval --mode split                       # Override output mode
orval --client react-query               # Override client
orval --mock                             # Override mock generation
orval --input ./spec.yaml --output ./api.ts  # Direct generation
```

## Resources

- [Documentation](https://orval.dev)
- [GitHub](https://github.com/orval-labs/orval)
- [Sample Projects](https://github.com/orval-labs/orval/tree/master/samples)
