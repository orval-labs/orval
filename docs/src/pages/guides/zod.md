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

The tRPC model will generate an implementation file with one tRPC route query or mutation per path in your OpenApi Specification.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/zod/basic/petstore.yaml" target="_blank">swagger</a>:

```ts
export const showPetById = (
  petId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<Pet>> => {
  return axios.get(`/pets/${petId}`, options);
};

export const showPetByIdRoute = trpc.router().query('showPetById', {
  input: zod.object({
    petId: zod.string().required(),
    testId: zod.string().required(),
    version: zod.number().notRequired(),
  }),
  resolve: ({ input: { petId, version }, ctx }) => showPetById(petId, version),
});
```

Checkout <a href="https://github.com/anymaniax/orval/blob/master/samples/zod/basic" target="_blank">here</a> the full example
