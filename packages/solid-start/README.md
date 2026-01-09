# @orval/solid-start

SolidStart client for Orval - generates type-safe API client code using SolidStart primitives.

## Features

- ✅ Generates SolidStart `query()` for GET requests
- ✅ Generates SolidStart `action()` for mutations (POST, PUT, PATCH, DELETE)
- ✅ Type-safe API calls
- ✅ Full TypeScript support
- ✅ Works with SolidStart's server-side execution model

## Installation

```bash
npm install @orval/solid-start
# or
yarn add @orval/solid-start
# or
pnpm add @orval/solid-start
```

## Usage

In your Orval configuration file:

```typescript
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: './src/api/endpoints.ts',
      schemas: './src/api/model',
      client: 'solid-start',
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
```

## Generated Code

For GET requests, Orval generates SolidStart queries:

```typescript
export const PetstoreApi = {
  getPets: query(async (limit?: number) => {
    const response = await fetch(`/api/pets?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<Pet[]>;
  }, "getPets"),
};
```

For mutations (POST, PUT, PATCH, DELETE), Orval generates SolidStart actions:

```typescript
export const PetstoreApi = {
  createPet: action(async (pet: Pet) => {
    const response = await fetch(`/api/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pet),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<Pet>;
  }, "createPet"),
};
```

## Using in Your SolidStart App

```typescript
import { PetstoreApi } from './api/endpoints';

// In a component
function Pets() {
  const pets = createAsync(() => PetstoreApi.getPets(10));
  
  return (
    <div>
      <For each={pets()}>
        {(pet) => <div>{pet.name}</div>}
      </For>
    </div>
  );
}

// For mutations
function CreatePet() {
  const createPet = useAction(PetstoreApi.createPet);
  
  const handleSubmit = async (formData: FormData) => {
    await createPet({ name: formData.get('name') as string });
  };
  
  return <form action={handleSubmit}>...</form>;
}
```

## Comparison with solid-query

- **@orval/solid-start**: Uses native SolidStart primitives (`query`, `action`) for server-side data fetching
- **@orval/solid-query**: Uses TanStack Solid Query (`createQuery`, `createMutation`) for client-side data management

Choose `solid-start` when you want to leverage SolidStart's built-in server functions and caching.
Choose `solid-query` when you need advanced client-side query management features like automatic refetching, optimistic updates, etc.
