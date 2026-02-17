# SolidStart Client

Uses native SolidStart primitives (`query()` and `action()` from `@solidjs/router`) instead of TanStack Query.

```ts
output: {
  client: 'solid-start',
  mode: 'tags-split',
  target: 'src/api/petstore.ts',
  schemas: 'src/api/model',
  mock: true,
}
```

Generated output:

```ts
import { query, action } from '@solidjs/router';

export const SwaggerPetstore = {
  // GET requests -> query() with automatic caching
  listPets: query(async (params: ListPetsParams) => {
    const queryString = new URLSearchParams(params as any).toString();
    const url = queryString ? `/pets?${queryString}` : `/pets`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json() as Promise<Pets>;
  }, 'listPets'),

  // POST/PUT/PATCH/DELETE -> action() (mutations, not cached)
  createPets: action(async (createPetsBody: CreatePetsBody) => {
    const response = await fetch('/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPetsBody),
    });
    return response.json() as Promise<Pet>;
  }, 'createPets'),
};
```

## Cache Invalidation

```ts
import { revalidate } from '@solidjs/router';

// Invalidate all instances of a query
revalidate(SwaggerPetstore.listPets.key);

// Invalidate specific call by arguments
revalidate(SwaggerPetstore.showPetById.keyFor('pet-123'));
```

## Usage with Components

```tsx
import { createAsync } from '@solidjs/router';
import { Suspense } from 'solid-js';

function PetDetails(props: { petId: string }) {
  const pet = createAsync(() => SwaggerPetstore.showPetById(props.petId));
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <h1>{pet()?.name}</h1>
    </Suspense>
  );
}

// Actions work with HTML forms
<form action={SwaggerPetstore.createPets} method="post">
  <input name="name" required />
  <button type="submit">Create Pet</button>
</form>

// Or programmatically
function DeletePetButton(props: { petId: string }) {
  const deletePet = useAction(SwaggerPetstore.deletePetById);
  return <button onClick={() => deletePet(props.petId)}>Delete</button>;
}
```
