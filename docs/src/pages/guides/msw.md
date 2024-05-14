---
id: msw
title: MSW
---

If you want to generate a mock, define the `mock` property to `true` and a mock of `MSW` will be generated in the target file. You can check <a href="https://mswjs.io/" target="_blank">MSW</a> to configure MSW correctly in your project.

#### Example of orval.config.js

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

#### A function that returns a mocked value of a schema object

A function that returns a mock object will be generated as shown below:

```typescript
import { faker } from '@faker-js/faker';

export const getShowPetByIdMock = (overrideResponse?: Partial<Type>): Type => ({
  id: faker.number.int({ min: undefined, max: undefined }),
  name: faker.word.sample(),
  tag: faker.helpers.arrayElement([faker.word.sample(), undefined]),
  ...overrideResponse,
});
```

The value is implemented in `faker.js`.
If you want to overwrite part of the object, you can write the mock value by specifying it as a function argument.

```typescript
import { getShowPetByIdMock } from 'pets.msw';

const pet = getShowPetByIdMock({ name: 'override' });
console.log(pet);
// => { id: 7272122785202176, ​name: "override", tag: undefined }
```

#### A function that returns the value of binding the mock object to the http request handler of `MSW`

A function is generated that returns the value of the mock object bound to the `MSW` http request handler as shown below:

```typescript
import { HttpResponse, delay, http } from 'msw';

export const getShowPetByIdMockHandler = (overrideResponse?: Pet) => {
  return http.get('*/pets/:petId', async () => {
    await delay(1000);
    return new HttpResponse(
      JSON.stringify(
        overrideResponse ? overrideResponse : getShowPetByIdMock(),
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

#### A function that returns an `Array` that aggregates all handlers in the file.

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
