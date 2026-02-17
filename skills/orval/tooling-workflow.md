# Tooling & Workflow

## MCP (AI Agent Tools)

Generate Model Context Protocol servers from OpenAPI specs for AI agent integration (Claude, Cline, etc.):

```ts
output: {
  mode: 'single',       // ONLY works in single mode
  client: 'mcp',
  baseUrl: 'https://petstore3.swagger.io/api/v3',
  target: 'src/handlers.ts',
  schemas: 'src/http-schemas',
}
```

Generated files:
- `src/http-schemas/` — TypeScript types
- `src/handlers.ts` — Handler functions returning MCP format
- `src/http-client.ts` — Generated fetch client
- `src/server.ts` — MCP tools and server configuration
- `src/tool-schemas.zod.ts` — Zod schemas for tool inputs

Deploy with Docker and configure in your MCP client (e.g. Cline's `mcpServers` config).

## NDJSON Streaming

Type-safe newline-delimited JSON streaming. Only supported with Fetch client.

OpenAPI schema:

```yaml
paths:
  /stream:
    get:
      responses:
        '200':
          content:
            application/x-ndjson:
              schema:
                $ref: '#/components/schemas/StreamEntry'
```

Generated types and function:

```ts
export type streamResponse200 = {
  stream: TypedResponse<StreamEntry>;
  status: 200;
};

export const stream = async (
  options?: RequestInit,
): Promise<streamResponse> => {
  const stream = await fetch(getStreamUrl(), {
    ...options,
    method: 'GET',
    headers: { Accept: 'application/x-ndjson', ...options?.headers },
  });
  return { status: stream.status, stream, headers: stream.headers } as streamResponse;
};
```

Reading the stream:

```ts
export const readStream = <T extends object>(
  response: Response & { json(): Promise<T> },
  processLine: (value: T) => void,
): Promise<void> => {
  if (!response.body) return Promise.resolve();
  const stream = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const loop = (): Promise<void> =>
    stream.read().then(({ done, value }) => {
      if (done) {
        if (buffer.length > 0) processLine(JSON.parse(buffer));
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? '';
      for (const part of parts.filter(Boolean)) {
        processLine(JSON.parse(part) as T);
      }
      return loop();
    });
  return loop();
};

// Usage
const results: StreamEntry[] = [];
const response = await stream();
if (response.status === 200) {
  await readStream(response.stream, (obj) => results.push(obj));
}
```

## Input Transformers

Transform the OpenAPI spec before generation:

```ts
input: {
  target: './spec.yaml',
  override: {
    transformer: './transformers/add-auth-header.js',
  },
}
```

```js
// add-auth-header.js
module.exports = (openAPIDocument) => {
  // Modify and return the spec
  return openAPIDocument;
};
```

## Hooks (afterAllFilesWrite)

Run scripts after Orval generates files:

```ts
export default defineConfig({
  petstore: {
    input: './petstore.yaml',
    output: './petstore.ts',
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

Multiple commands:

```ts
hooks: {
  afterAllFilesWrite: ['prettier --write', 'eslint --fix'],
}
```

Disable file path injection:

```ts
hooks: {
  afterAllFilesWrite: {
    command: 'prettier --write .',
    injectGeneratedDirsAndFiles: false,
  },
}
```

## Programmatic API

Use Orval programmatically in build scripts:

```ts
import { generate } from 'orval';

// From config file
await generate('./orval.config.ts');

// With direct configuration
import type { Options } from 'orval';

const config: Options = {
  input: { target: './api-spec.yaml' },
  output: { target: './src/api.ts', client: 'axios' },
};
await generate(config);
```

With global options override:

```ts
import { generate, type GlobalOptions } from 'orval';

const globalOptions: GlobalOptions = {
  watch: true,
  // watch: ['./specs/*.yaml'],   // Watch specific patterns
  clean: true,
  prettier: true,
  client: 'fetch',
  mode: 'split',
  mock: true,
  tsconfig: './tsconfig.json',
};

await generate('./orval.config.ts', process.cwd(), globalOptions);
```

Function signature:

```ts
function generate(
  optionsExport?: string | OptionsExport,
  workspace?: string,
  options?: GlobalOptions,
): Promise<void>;
```

Build script integration:

```json
{
  "scripts": {
    "generate": "node scripts/generate-api.js",
    "dev": "npm run generate && next dev",
    "build": "npm run generate && next build"
  }
}
```

```js
// scripts/generate-api.js
const { generate } = require('orval');

async function main() {
  try {
    await generate();
    console.log('API client generated successfully');
  } catch (error) {
    console.error('Failed to generate API client:', error);
    process.exit(1);
  }
}

main();
```
