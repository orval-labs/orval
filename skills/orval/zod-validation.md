# Zod Schema Generation

## Standalone Zod Schemas

```ts
output: {
  client: 'zod',
  target: './src/api/schemas',
}
```

Generated:

```ts
export const createPetsBody = zod.object({
  id: zod.number(),
  name: zod.string(),
  tag: zod.string().optional(),
});
```

## Combined with HTTP Client

```ts
export default defineConfig({
  petstore: {
    input: { target: './petstore.yaml' },
    output: {
      client: 'react-query',
      target: 'src/api/endpoints',
      schemas: 'src/api/models',
    },
  },
  petstoreZod: {
    input: { target: './petstore.yaml' },
    output: {
      client: 'zod',
      target: 'src/api/endpoints',
      fileExtension: '.zod.ts',  // Avoid filename conflicts
    },
  },
});
```

## Zod Options

```ts
override: {
  zod: {
    strict: {
      response: true,
      query: true,
      param: true,
      header: true,
      body: true,
    },
    coerce: {
      query: ['string', 'number', 'boolean'],
    },
    generate: {
      param: true,
      body: true,
      response: true,
      query: true,
      header: true,
    },
    preprocess: {
      response: {
        name: 'stripNill',
        path: './src/mutators.ts',
      },
    },
    generateEachHttpStatus: true,
    dateTimeOptions: { ... },
    timeOptions: { ... },
  },
}
```

Preprocess example for stripping null/undefined before validation:

```ts
export const stripNill = (object: unknown) =>
  !!object && typeof object === 'object' && !Array.isArray(object)
    ? Object.fromEntries(
        Object.entries(object).filter(
          ([_, value]) => value !== null && value !== undefined,
        ),
      )
    : object;
```

## Runtime Validation with Fetch Client

```ts
output: {
  client: 'fetch',
  override: {
    fetch: {
      runtimeValidation: true,  // Validate responses with Zod schemas
    },
  },
}
```
