---
id: client-with-zod
title: client-with-zod
---

If you want to use `zod` with your `swr` or `TanStack Query` client, you can do so by configuring it as follows.

#### Example of orval.config.js

```js
module.exports = {
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'swr',
      target: 'src/gen/endpoints',
      schemas: 'src/gen/models',
      mock: true,
    },
  },
  petstoreZod: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: 'src/gen/endpoints',
      fileExtension: '.zod.ts',
    },
  },
};
```

Here we describe the generation of `zod` and the definition of `swr`. `petstoreZod` avoids conflicts in generated file names by specifying `.zod.ts` for `output.fileExtension` and not defining `schemas`. Also, `mock` only needs to be generated once, so it is defined only in `petstore`.

The files that are actually automatically generated are as follows:

```
samples/swr-with-zod/src/gen/
├── endpoints
│   └── pets
│       ├── pets.msw.ts
│       ├── pets.ts
│       └── pets.zod.ts
└── models
```

The automatically generated `swr` and `zod` definitions can be used in your application as follows:

```ts
import { Pet } from './gen/models';
import { useListPets, useCreatePets } from './gen/endpoints/pets/pets';
import { createPetsBodyItem } from './gen/endpoints/pets/pets.zod';

function App() {
  const { data } = useListPets();
  const { trigger } = useCreatePets();

  const createPet = async () => {
    // For example, specifying the number 123 in the name will result in a `zod` error.
    const pet = { name: '123', tag: 'test' };

    try {
      const parsedPet = createPetsBodyItem.parse(pet);

      await trigger([parsedPet]);
    } catch (error) {
      console.log('raise error', error);
    }
  };
}
```

See below for the complete [sample app](https://github.com/orval-labs/orval/tree/master/samples/swr-with-zod).
