---
id: hono
title: Hono
---

If you want to generate a hono, define the `client` property to `hono` and a template of `Hono` will be generated in the target file and directory. You can check <a href="https://hono.dev/docs/getting-started/cloudflare-workers" target="_blank">Hono</a>.

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

## generate template

`orval` generates a file like the following:

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

- petstore.ts: Initializes hono and defines endpoints.
- handlers: Contains templates for each endpoint.
- petstore.schemas.ts: Defines request and response schemas.
- petstore.validator.ts: Implements hono validator.
- petstore.zod.ts: Defines schemas using zod for validation.
- petstore.context.ts: Defines context for endpoints.

## implement endpoint proccess to handler

`Orval` generates a handler template for `Hono`. For example, check out `listPets.ts`.
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

You can implement the API just by defining the response according to the response schema.

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

## run `Hono` dev server

you can run and check by `wrangler dev` commnad.
The entrypoint is `src/petstore.ts` instead of `src/index.ts`.

```bash
yarn wrangler dev src/petstore.ts
curl http://localhost:8787/pets #=> [{"id":1,"name":"doggie"}]
```

Checkout <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/hono-with-zod" target="_blank">here</a> the full example. And if you want to develop both the frontend and backend with `Typescript` using `Hono`, `fetch`, and `Next.js`, please check <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/hono-with-fetch-client" target="_blank">here</a> as well.

## Using composite routes and handlers split by tags in `OpenAPI`

If you want to using `tags` or `tags-split` mode, which splits handlers by tags defined in `OpenAPI`, but want to generate a composite single `hono` route file, define file path like a `src/routes.ts` to the `override.hono.compositeRoute` property and the `Hono` template generates a composite root file in the target file and directory.

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

Then it will be generated as below:

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

`routes.ts` composites all routes as shown below:

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

You can prepare a hono server like `app.ts` and embed it like this:

```ts:app.ts
import { Hono } from 'hono';
import routes from './routes';

const app = new Hono();

app.route('/', routes);

export default app;
```

run `Hono` dev server as usual.

```bash
yarn wrangler dev src/app.ts
curl http://localhost:8787/pets #=> [{"id":1,"name":"doggie"}]
```

Checkout <a href="https://github.com/orval-labs/orval/tree/master/samples/hono/composite-routes-with-tags-split" target="_blank">here</a> the full example.
