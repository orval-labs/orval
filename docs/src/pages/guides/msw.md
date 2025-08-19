---
id: msw
title: MSW
---

If you want to generate a mock, define the `mock` property to `true` and a mock of `MSW` will be generated in the target file. You can check <a href="https://mswjs.io/" target="_blank">MSW</a> to configure MSW correctly in your project.

## Example of orval.config.js

```js
module.exports = {
  'petstore-file-transfomer': {
    output: {
      mode: 'single',
      target: './src/petstore.ts',
      schemas: './src/model',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

The mock definition consists of the following three functions.

1. A function that returns a mocked value of a schema object
2. A function that returns the value of binding the mock object to the http request handler of `MSW`
3. A function that returns an `Array` that aggregates all handlers in the file.

## A function that returns a mocked value of a schema object

A function that returns a mock object will be generated as shown below:

```typescript
import { faker } from '@faker-js/faker';

export const getShowPetByIdResponseMock = (
  overrideResponse: Partial<Pet> = {},
): Pet => ({
  id: faker.number.int({ min: undefined, max: undefined }),
  name: faker.string.alpha(20),
  tag: faker.string.alpha(20),
  ...overrideResponse,
});
```

The value is implemented in `faker.js`.
If you want to overwrite part of the object, you can write the mock value by specifying it as a function argument.

```typescript
import { getShowPetByIdMock } from 'pets.msw';

const pet = getShowPetByIdResponseMock({ name: 'override' });
console.log(pet);
// => { id: 7272122785202176, ​name: "override", tag: undefined }
```

## A function that returns the value of binding the mock object to the http request handler of `MSW`

A function is generated that returns the value of the mock object bound to the `MSW` http request handler as shown below:

```typescript
import { HttpResponse, delay, http } from 'msw';

export const getShowPetByIdMockHandler = (
  overrideResponse?:
    | Pet
    | ((
        info: Parameters<Parameters<typeof http.get>[1]>[0],
      ) => Promise<Pet> | Pet),
) => {
  return http.get('*/pets/:petId', async (info) => {
    await delay(1000);
    return new HttpResponse(
      JSON.stringify(
        overrideResponse !== undefined
          ? typeof overrideResponse === 'function'
            ? await overrideResponse(info)
            : overrideResponse
          : getShowPetByIdResponseMock(),
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });
};
```

If you want to overwrite mocked http response object, you can write the object by specifying it as a function argument.

```typescript
import { Pet } from './gen/model/pet';
import { getShowPetByIdMockHandler } from 'petstore.msw';

const pet: Pet = { id: 1, name: 'test', tag: 'test' };

const showPetByIdMockHandler = getShowPetByIdMockHandler(pet);
console.log(showPetByIdMockHandler);
// => Object { info: {…}, isUsed: false, resolver: async getShowPetByIdMockHandler(), resolverGenerator: undefined, resolverGeneratorResult: undefined, options: {} }
```

You can also pass a function as an argument, which will be called every time a request is made to the API.

```ts
getShowPetByIdMockHandler((info) => {
  const body = await info.request.json();

  return { message: `body: ${body}` };
});
```

For example, if you want to use the generated mock in a test to verify that the API was called, you can use it as follows:

```ts
import { expect, vi } from 'vitest';
import { getShowPetByIdMock, getShowPetByIdMockHandler } from 'pets.msw';

const mockFn = vi.fn();

const mock = [
  getShowPetByIdMockHandler((info) => {
    const body = await info.request.json();

    mockFn(body);
    return getShowPetByIdResponseMock();
  }),
];

expect(mockFn).toHaveBeenCalledTimes(1);
```

## A function that returns an `Array` that aggregates all handlers in the file.

Aggregate all functions that return handlers and generate a function that returns as an `Array` as below:

```typescript
export const getPetsMock = () => [
  getListPetsMockHandler(),
  getCreatePetsMockHandler(),
  getShowPetByIdMockHandler(),
];
```

You can run the `MSW` server using this function.

```typescript
import { getPetsMock } from 'petstore.msw';
import { setupServer } from 'msw/node';

const server = setupServer();
server.use(...getPetsMock());
```
