---
id: hono
title: Hono
---

To generate a Hono template, define the `client` property to be `hono` and a template of Hono will be generated in the target file and directory. For further details, visit <a href="https://hono.dev/docs/getting-started/cloudflare-workers" target="_blank">the Hono documentation</a>.

## Example of orval.config.js

```js
module.exports = {
  petstore: {
    input: {
      target: './petstore.yaml',
    },
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
};
```

## Generating the Template

Orval generates files as follows:

```
src/
├── handlers
│   ├── createPets.ts
│   ├── listPets.ts
│   ├── showPetById.ts
│   └── updatePets.ts
├── index.ts
├── petstore.context.ts
├── petstore.schemas.ts
├── petstore.ts
├── petstore.validator.ts
└── petstore.zod.ts
```

- petstore.ts: Initializes Hono and defines endpoints.
- handlers: Contains templates for each endpoint.
- petstore.schemas.ts: Defines request and response schemas.
- petstore.validator.ts: Implements Hono validator.
- petstore.zod.ts: Defines schemas using Zod for validation.
- petstore.context.ts: Defines context for endpoints.

## Implementing an Endpoint Process Handler

Orval generates a handler template for Hono. For example, see `listPets.ts`.
Validation is defined for request and response. Only the actual processing is not implemented.

```ts
import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ListPetsContext } from '../petstore.context';
import { listPetsQueryParams, listPetsResponse } from '../petstore.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  zValidator('response', listPetsResponse),
  async (c: ListPetsContext) => {},
);
```

It is possible to implement the API by defining the response according to the response schema.

```diff
import { createFactory } from 'hono/factory';
import { zValidator } from '../petstore.validator';
import { ListPetsContext } from '../petstore.context';
import { listPetsQueryParams, listPetsResponse } from '../petstore.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('query', listPetsQueryParams),
  zValidator('response', listPetsResponse),
  async (c: ListPetsContext) => {
+    return c.json([
+      {
+        id: 1,
+        name: 'doggie',
+      },
+    ]);
  },
);
```

## Run Hono Dev Server

Use the `wrangler dev` command to run the Hono dev server.
Set the entrypoint as `src/petstore.ts` instead of `src/index.ts`.

```bash
yarn wrangler dev src/petstore.ts
curl http://localhost:8787/pets #=> [{"id":1,"name":"doggie"}]
```

See the full example <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/hono-with-zod" target="_blank">here</a>. To develop the frontend and backend with TypeScript using Hono, Fetch, and Next.js, see the sample app <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/hono-with-fetch-client" target="_blank">here</a>.

## Using Composite Routes and Handlers Split by Tags in OpenAPI

If you want to use `tags` or `tags-split` mode, which splits handlers by tags defined in OpenAPI, but want to generate a composite single Hono route file, define a file path such as `src/routes.ts` to the `override.hono.compositeRoute` property and the Hono template generates a composite root file in the target file and directory.

```js
module.exports = {
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'hono',
      target: 'src/endpoints',
      schemas: 'src/schemas',
      override: {
        hono: {
          compositeRoute: 'src/routes.ts',
        },
      },
    },
  },
};
```

The files will be generated as below:

```
src/
├── endpoints
│   ├── pets
│   │   ├── pets.context.ts
│   │   ├── pets.handlers.ts
│   │   └── pets.zod.ts
│   └── validator.ts
├── routes.ts
└── schemas
    ├── pet.ts
    └── pets.ts
```

`routes.ts` composes all routes as shown below:

```ts:routes.ts
import { Hono } from 'hono';
import {
  listPetsHandlers,
  createPetsHandlers,
  updatePetsHandlers,
  showPetByIdHandlers,
} from './endpoints/pets/pets.handlers';

const app = new Hono();

app.get('/pets', ...listPetsHandlers);
app.post('/pets', ...createPetsHandlers);
app.put('/pets', ...updatePetsHandlers);
app.get('/pets/:petId', ...showPetByIdHandlers);

export default app;
```

Prepare a Hono server like `app.ts` and embed it:

```ts:app.ts
import { Hono } from 'hono';
import routes from './routes';

const app = new Hono();

app.route('/', routes);

export default app;
```

Run the Hono dev server as usual.

```bash
yarn wrangler dev src/app.ts
curl http://localhost:8787/pets #=> [{"id":1,"name":"doggie"}]
```

See the full example <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/composite-routes-with-tags-split" target="_blank">here</a>.
