# Hono Server Client

Generate type-safe Hono server handlers with built-in Zod validation from OpenAPI specs.

## Quick Start

```bash
npm install hono @hono/zod-validator zod
```

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: { target: './petstore.yaml' },
    output: {
      mode: 'split',
      client: 'hono',
      target: 'src/petstore.ts',
      override: {
        hono: {
          handlers: 'src/handlers',
        },
      },
    },
  },
});
```

## Configuration Options

```ts
output: {
  client: 'hono',
  override: {
    hono: {
      handlers: 'src/handlers',             // Directory for per-operation handler files
      compositeRoute: 'src/routes.ts',      // Combined routes file (used with tags-split)
      validator: true,                       // true (default) | 'hono' | false
      validatorOutputPath: 'src/validator.ts', // Custom validator output path
    },
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `handlers` | `string` | — | Directory for per-operation handler files. One file per operation. |
| `compositeRoute` | `string` | `''` (disabled) | Path for combined routes file. Used with `tags-split` mode. |
| `validator` | `boolean \| 'hono'` | `true` | `true` = orval's custom zValidator with response validation; `'hono'` = `@hono/zod-validator` directly (no response validation); `false` = no validators |
| `validatorOutputPath` | `string` | `''` (auto) | Custom output path for the generated validator file |

## Generated File Structure

### `split` mode with `handlers`

```
src/
├── handlers/
│   ├── listPets.ts           # Per-operation handler (NOT overwritten if exists)
│   ├── createPets.ts
│   ├── showPetById.ts
│   └── updatePets.ts
├── petstore.ts               # Hono app with routes (regenerated)
├── petstore.context.ts       # Type-safe context types (regenerated)
├── petstore.schemas.ts       # TypeScript types
├── petstore.validator.ts     # Custom zValidator wrapper (regenerated)
└── petstore.zod.ts           # Zod schemas (regenerated)
```

### `tags-split` with `compositeRoute`

```
src/
├── endpoints/
│   └── pets/
│       ├── pets.context.ts
│       ├── pets.handlers.ts  # All handlers for tag in one file
│       └── pets.zod.ts
├── schemas/
│   ├── pet.ts
│   ├── pets.ts
│   └── index.ts
├── routes.ts                 # Combined routes file
└── endpoints/validator.ts    # Shared validator
```

### `tags` mode

```
src/
├── handlers/
│   ├── listPets.ts
│   └── createPets.ts
├── pets.ts                   # Route file per tag
├── pets.context.ts
├── pets.zod.ts
└── pets.validator.ts
```

## Generated Route File

```ts
import { Hono } from 'hono';
import { listPetsHandlers } from './handlers/listPets';
import { createPetsHandlers } from './handlers/createPets';
import { showPetByIdHandlers } from './handlers/showPetById';

const app = new Hono();

app.get('/pets', ...listPetsHandlers);
app.post('/pets', ...createPetsHandlers);
app.get('/pets/:petId', ...showPetByIdHandlers);

export default app;
```

OpenAPI path params `{petId}` are converted to Hono format `:petId`.

## Handler Templates

### Query parameters

```ts
import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ListPetsContext } from '../petstore.context';
import { listPetsQueryParams, listPetsResponse } from '../petstore.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  zValidator('response', listPetsResponse),
  async (c: ListPetsContext) => {
    return c.json([{ id: 1, name: 'Buddy' }]);
  },
);
```

### Path parameters

```ts
import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ShowPetByIdContext } from '../petstore.context';
import { showPetByIdParams, showPetByIdResponse } from '../petstore.zod';

const factory = createFactory();

export const showPetByIdHandlers = factory.createHandlers(
  zValidator('param', showPetByIdParams),
  zValidator('response', showPetByIdResponse),
  async (c: ShowPetByIdContext) => {
    const { petId } = c.req.valid('param');
    return c.json({ id: Number(petId), name: 'Buddy' });
  },
);
```

### JSON body

```ts
import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { CreatePetsContext } from '../petstore.context';
import { createPetsBody, createPetsResponse } from '../petstore.zod';

const factory = createFactory();

export const createPetsHandlers = factory.createHandlers(
  zValidator('json', createPetsBody),
  zValidator('response', createPetsResponse),
  async (c: CreatePetsContext) => {
    const body = c.req.valid('json');
    return c.json({ id: 1, ...body });
  },
);
```

### Validator order in generated handlers

1. `zValidator('header', ...)` — if request headers exist
2. `zValidator('param', ...)` — if path parameters exist
3. `zValidator('query', ...)` — if query parameters exist
4. `zValidator('json', ...)` — if request body exists
5. `zValidator('response', ...)` — if 200 JSON response exists AND `validator !== 'hono'`

## Context Types

Generated context types encode the validated input shape for type-safe access:

```ts
import type { Context, Env } from 'hono';

export type ListPetsContext<E extends Env = any> = Context<
  E,
  '/pets',
  { in: { query: ListPetsParams }; out: { query: ListPetsParams } }
>;

export type ShowPetByIdContext<E extends Env = any> = Context<
  E,
  '/pets/:petId',
  {
    in: { param: { petId: string } };
    out: { param: { petId: string } };
  }
>;

export type CreatePetsContext<E extends Env = any> = Context<
  E,
  '/pets',
  { in: { json: CreatePetsBodyItem[] }; out: { json: CreatePetsBodyItem[] } }
>;
```

When an operation has no params/query/body, the third generic is omitted.

A `NonReadonly<T>` utility type is emitted only when schema types contain readonly properties.

## zValidator (Response Validation)

Orval's custom `zValidator` extends `@hono/zod-validator` with a `response` target:

```ts
zValidator('response', responseSchema)
```

Response validation behavior (when `validator: true`):
- Runs as post-middleware (calls `await next()` first)
- Only validates HTTP 200 responses with `Content-Type: application/json`
- Uses `safeParseAsync` — supports Zod v3 and v4
- On parse failure: returns HTTP 400 with `{ success, data, error }`
- On malformed JSON: returns HTTP 400 with `'Malformed JSON in response'`
- Supports optional `hook` callback for custom validation handling

See the `validator` option in Configuration Options above for the three modes (`true`, `'hono'`, `false`).

## Composite Routes

For `tags-split` mode with multiple tag groups:

```ts
output: {
  mode: 'tags-split',
  client: 'hono',
  target: 'src/endpoints',
  schemas: 'src/schemas',
  override: {
    hono: {
      compositeRoute: 'src/routes.ts',
      validatorOutputPath: 'src/endpoints/validator.ts',
    },
  },
}
```

Generated `routes.ts`:

```ts
import { Hono } from 'hono';
import {
  listPetsHandlers,
  createPetsHandlers,
  showPetByIdHandlers,
} from './endpoints/pets/pets.handlers';

const app = new Hono();

app.get('/pets', ...listPetsHandlers);
app.post('/pets', ...createPetsHandlers);
app.get('/pets/:petId', ...showPetByIdHandlers);

export default app;
```

Wire it up in your app entry point:

```ts
import { Hono } from 'hono';
import routes from './routes';

const app = new Hono();
app.route('/', routes);

export default app;
```

Without `compositeRoute` in `tags-split` mode, you must wire routes manually.

## Zod Schema Options for Hono

Control how Zod schemas are generated alongside Hono handlers:

```ts
override: {
  hono: {
    handlers: 'src/handlers',
  },
  zod: {
    strict: {
      response: true,         // Add .strict() to response schemas
    },
    preprocess: {
      response: {
        name: 'stripNill',
        path: './src/mutators.ts',
      },
    },
  },
}
```

```ts
// src/mutators.ts
export const stripNill = (object: unknown) =>
  !!object && typeof object === 'object' && !Array.isArray(object)
    ? Object.fromEntries(
        Object.entries(object).filter(
          ([_, value]) => value !== null && value !== undefined,
        ),
      )
    : object;
```

## Zod Schema Naming Conventions

| Type | Pattern | Example |
|---|---|---|
| Query params | `{PascalName}QueryParams` | `ListPetsQueryParams` |
| Path params | `{PascalName}Params` | `ShowPetByIdParams` |
| Request headers | `{PascalName}Header` | `ListPetsHeader` |
| Request body | `{PascalName}Body` | `CreatePetsBody` |
| Array body items | `{PascalName}BodyItem` | `CreatePetsBodyItem` |
| Response | `{PascalName}Response` | `ListPetsResponse` |

## Full Examples

### Split mode with handlers

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: { target: './petstore.yaml' },
    output: {
      mode: 'split',
      client: 'hono',
      target: 'src/petstore.ts',
      override: {
        hono: {
          handlers: 'src/handlers',
        },
        zod: {
          strict: { response: true },
          preprocess: {
            response: {
              name: 'stripNill',
              path: './src/mutators.ts',
            },
          },
        },
      },
    },
  },
});
```

### Tags-split with composite routes

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: { target: './petstore.yaml' },
    output: {
      mode: 'tags-split',
      client: 'hono',
      target: 'src/endpoints',
      schemas: 'src/schemas',
      clean: true,
      override: {
        hono: {
          compositeRoute: 'src/routes.ts',
          validatorOutputPath: 'src/endpoints/validator.ts',
        },
      },
    },
  },
});
```

### Hono server + Fetch client (full-stack)

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstoreClient: {
    input: { target: './petstore.yaml' },
    output: {
      mode: 'tags-split',
      client: 'fetch',
      target: 'next-app/app/gen/',
      schemas: 'next-app/app/gen/models',
      clean: true,
      baseUrl: 'http://localhost:8787',
      mock: true,
    },
  },
  petstoreApi: {
    input: { target: './petstore.yaml' },
    output: {
      mode: 'split',
      client: 'hono',
      target: 'hono-app/src/petstore.ts',
      override: {
        hono: {
          handlers: 'hono-app/src/handlers',
        },
      },
    },
  },
});
```

## Key Behavioral Notes

- **Handler files are never overwritten** — existing handlers are preserved, new operations are appended
- **All other generated files are regenerated** on every run (routes, context, zod, validator)
- **Response validation only runs for HTTP 200 with `application/json`** — other status codes pass through
- **Cloudflare Workers** is the primary deployment target (use `wrangler dev`)
- **Required dependencies**: `hono`, `@hono/zod-validator`, `zod`

## Running

```bash
# Cloudflare Workers
wrangler dev src/index.ts

# Test
curl http://localhost:8787/pets
```
