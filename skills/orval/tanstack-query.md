# TanStack Query / SWR Clients

## React Query / TanStack Query

```ts
output: {
  client: 'react-query',
  override: {
    query: {
      useQuery: true,
      useMutation: true,
      useInfinite: true,
      useInfiniteQueryParam: 'cursor',
      useSuspenseQuery: true,
      useSuspenseInfiniteQuery: true,
      usePrefetch: true,
      useInvalidate: true,
      signal: true,
      shouldExportQueryKey: true,
      shouldSplitQueryKey: false,       // Array vs string query keys
      useOperationIdAsQueryKey: false,  // Use operationId instead of route path
      options: { staleTime: 10000 },
      mutationInvalidates: [
        {
          onMutations: ['createPets'],
          invalidates: ['listPets'],
        },
        {
          onMutations: ['deletePet', 'updatePet'],
          invalidates: [
            'listPets',
            { query: 'showPetById', params: ['petId'] },
          ],
        },
      ],
    },
  },
}
```

Generated hooks:

```ts
// Query hook with automatic query key
export const useShowPetById = <TData = Pet, TError = Error>(
  petId: string,
  options?: { query?: UseQueryOptions<Pet, TError, TData> },
) => {
  const queryKey = getShowPetByIdQueryKey(petId);
  const queryFn = () => showPetById(petId);
  return useQuery({ queryKey, queryFn, enabled: !!petId, ...options?.query });
};

// Exported query key for manual invalidation
export const getShowPetByIdQueryKey = (petId: string) => [`/pets/${petId}`];
```

## Vue Query

```ts
output: {
  client: 'vue-query',
  // Same override.query options as React Query
}
```

## Svelte Query

```ts
output: {
  client: 'svelte-query',
  // Same override.query options as React Query
}
```

## Solid Query

For standalone SolidJS apps (not SolidStart):

```ts
output: {
  client: 'solid-query',
  // Same override.query options as React Query
}
```

## SWR

```ts
output: {
  client: 'swr',
  override: {
    swr: {
      useInfinite: true,
      useSuspense: true,
      useSWRMutationForGet: false,
      generateErrorTypes: false,
      swrOptions: { dedupingInterval: 10000 },
      swrMutationOptions: { revalidate: true },
      swrInfiniteOptions: { initialSize: 10 },
    },
  },
}
```

## Query Invalidation Patterns

Basic invalidation:

```ts
override: {
  query: {
    useInvalidate: true,
    mutationInvalidates: [
      {
        onMutations: ['createPets'],
        invalidates: ['listPets'],
      },
    ],
  },
}
```

Advanced invalidation with params and cross-file references:

```ts
mutationInvalidates: [
  {
    onMutations: ['deletePet', 'updatePet', 'patchPet'],
    invalidates: [
      'listPets',
      { query: 'showPetById', params: ['petId'] },
      { query: 'adminPets', file: './admin' },
    ],
  },
  {
    onMutations: ['uploadFile'],
    invalidates: ['listPets'],
  },
],
```

Reset mode (reset query state instead of refetch):

```ts
invalidates: [
  { query: 'showPetById', params: ['petId'], invalidationMode: 'reset' },
],
```

Skip invalidation at runtime:

```ts
const deletePet = useDeletePet({
  mutation: {
    onSuccess: () => {
      // Custom invalidation logic
      queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
    },
  },
  skipInvalidation: true,
});
```
