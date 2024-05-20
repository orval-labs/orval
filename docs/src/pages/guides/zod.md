---
id: zod
title: zod
---

To create a `zod` schema, specify the client property as `zod`, and it will automatically generate in the target file. Ensure to configure `zod` properly in your project by referring to <a href="https://zod.dev/" target="_blank">Zod</a>.

#### Example of orval.config.js

```js
module.exports = {
  petstore: {
    output: {
      client: 'zod',
      mode: 'single',
      target: './src/gen/zod',
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

An implementation file will be created, containing a `zod` object for each schema in your OpenAPI Specification, as illustrated below:

```ts
export const createPetsBody = zod.object({
  id: zod.number(),
  name: zod.string(),
  tag: zod.string().optional(),
});
```

### How use generated `zod` object

The `zod` object generated automatically can be utilized in the usual manner.

```ts
import type { z } from 'zod';
import { createPetsBodyItem } from './src/gen/zod/swaggerPetstore.ts';

const pet = { id: 1, name: 'pet name', tag: 'tag' };

// parsing
const parsedPet = createPetsBodyItem.parse(pet);
console.log(parsedPet);
// => Object { id: 1, name: "pet name", tag: "tag" }

// inferred type
type Pet = z.infer<typeof createPetsBodyItem>;
console.log(pet as Pet);
// => Object { id: 1, name: "pet name", tag: "tag" }
```
