---
id: zod
title: zod
---

You should have an OpenApi specification and an Orval config where you define the mode as zod.

#### Example with zod

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'zod',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.

The zod model will generate an implementation file containing the params, headers and body as Zod objects.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/zod/petstore.yaml" target="_blank">swagger</a>:

```ts
import * as zod from 'zod';

/**
 * @summary List all pets
 */
export const listPetsParams = zod.object({
  limit: zod.string().optional(),
  sort: zod.enum(['name', '-name', 'email', '-email']),
  version: zod.number().optional(),
});

export const listPetsHeader = zod.object({
  'X-EXAMPLE': zod.enum(['ONE', 'TWO', 'THREE']),
});

/**
 * @summary Create a pet
 */
export const createPetsParams = zod.object({
  limit: zod.string().optional(),
  sort: zod.enum(['name', '-name', 'email', '-email']),
  version: zod.number().optional(),
});

export const createPetsBody = zod.object({
  name: zod.string(),
  tag: zod.string(),
});

export const createPetsHeader = zod.object({
  'X-EXAMPLE': zod.enum(['ONE', 'TWO', 'THREE']),
});

/**
 * @summary Info for a specific pet
 */
export const showPetByIdParams = zod.object({
  petId: zod.string(),
  testId: zod.string(),
  version: zod.number().optional(),
});
```

Checkout <a href="https://github.com/anymaniax/orval/blob/master/samples/zod" target="_blank">here</a> the full example
