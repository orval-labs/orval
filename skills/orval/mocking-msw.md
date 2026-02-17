# MSW Mock Generation

```ts
output: {
  mock: true,
  // or with options:
  mock: {
    type: 'msw',
    delay: 1000,
    delayFunctionLazyExecute: false,
    useExamples: true,
    generateEachHttpStatus: false,
    baseUrl: 'https://api.example.com',
    locale: 'en',
    preferredContentType: 'application/json',
  },
}
```

Generated mock handler:

```ts
export const getShowPetByIdMockHandler = (
  overrideResponse?: Pet | ((info: RequestHandlerOptions) => Promise<Pet>),
  options?: RequestHandlerOptions,
) => {
  return http.get('*/pets/:petId', async (info) => {
    await delay(1000);
    return HttpResponse.json(
      overrideResponse !== undefined
        ? typeof overrideResponse === 'function'
          ? await overrideResponse(info)
          : overrideResponse
        : getShowPetByIdResponseMock(),
      { status: 200 },
    );
  }, options);
};

export const getShowPetByIdResponseMock = (
  overrideResponse: Partial<Pet> = {},
): Pet => ({
  id: faker.number.int(),
  name: faker.string.alpha(20),
  tag: faker.string.alpha(20),
  ...overrideResponse,
});
```

Content-type aware responses — MSW handlers automatically use the correct helper:

| Content type | Response helper |
|---|---|
| `application/json` | `HttpResponse.json()` |
| `application/xml`, `*+xml` | `HttpResponse.xml()` |
| `text/html` | `HttpResponse.html()` |
| `text/plain`, other `text/*` | `HttpResponse.text()` |
| `application/octet-stream`, `image/*` | `HttpResponse.arrayBuffer()` |
| No body (204, etc.) | `new HttpResponse(null, { status })` |

## Test Setup with Vitest

```ts
import { getListPetsMockHandler, getShowPetByIdMockHandler } from './api/petstore.msw';
import { setupServer } from 'msw/node';

const server = setupServer(...getListPetsMockHandler());

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Override for specific test
it('handles empty list', () => {
  server.use(getListPetsMockHandler([]));
  // ...
});

// Dynamic response based on request
it('returns pet by id', () => {
  server.use(
    getShowPetByIdMockHandler(async ({ params }) => ({
      id: Number(params.petId),
      name: 'Test Pet',
    })),
  );
  // ...
});
```

## Mock Customization

```ts
override: {
  mock: {
    properties: {
      '/tag|name/': 'jon',              // Regex match
      email: () => faker.internet.email(),
    },
    format: {
      email: () => faker.internet.email(),
      iban: () => faker.finance.iban(),
    },
    required: true,
    delay: 500,
    arrayMin: 1,
    arrayMax: 10,
    stringMin: 10,
    stringMax: 20,
    numberMin: 0,
    numberMax: 100,
    fractionDigits: 2,
  },
}
```

Per-operation mock data:

```ts
override: {
  operations: {
    listPets: {
      mock: {
        properties: () => ({
          '[].id': () => faker.number.int({ min: 1, max: 99999 }),
        }),
      },
    },
    showPetById: {
      mock: {
        data: () => ({
          id: faker.number.int({ min: 1, max: 99 }),
          name: faker.person.firstName(),
          tag: faker.helpers.arrayElement([faker.word.sample(), undefined]),
        }),
      },
    },
  },
}
```

## Dynamic Mock Imports (indexMockFiles)

Generate an index file for all mock handlers in `tags-split` mode:

```ts
output: {
  mode: 'tags-split',
  mock: true,
  indexMockFiles: true,
}
```
