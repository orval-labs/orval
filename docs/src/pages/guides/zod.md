---
id: zod
title: zod
---

If you want to generate a `zod` schema, define the `client` property to `zod` and will be generated in the target file. You can check <a href="https://zod.dev/" target="_blank">Zod</a> to configure `zod` correctly in your project.

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

Will generate an implementation file with the `zod` object per schema in your OpenAPI Specification like a bellow:

```ts
export const createPetsBody = zod.object({
  id: zod.number(),
  name: zod.string(),
  tag: zod.string().optional(),
});
```

### How use generated `zod` object

The automatically generated `zod` object can be used as usual.

```ts
import type { z } from 'zod';
import { createPetsBody } from './src/gen/zod/swaggerPetstore.ts';

const pet = { id: 1, name: 'pet name', tag: 'tag' };

// parsing
const parsedPet = createPetsBodyItem.parse();
console.log(parsedPet);
// => Object { id: 1, name: "pet name", tag: "tag" }

// inferred type
type Pet = z.infer<typeof createPetsBodyItem>;
console.log(pet as Pet);
// => Object { id: 1, name: "pet name", tag: "tag" }
```
