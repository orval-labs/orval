import { keepPreviousData } from '@tanstack/react-query';

import {
  useCreatePets,
  useListPets,
  useListPetsInfinite,
} from '../generated/react-query/mutator/endpoints';

export const useInfiniteQueryTest = () => {
  const { data } = useListPetsInfinite(
    {
      sort: 'name',
    },
    0,
    {
      query: {
        getNextPageParam: (lastPage) => lastPage[0].id.toString(),
      },
    },
  );

  const pages = data?.pages.flatMap((page) => page.map((pet) => pet.name));

  return pages;
};

export const useHookWithPlaceHolderData = () => {
  const { data } = useListPets(
    {
      sort: 'name',
    },
    0,
    {
      query: {
        placeholderData: keepPreviousData,
      },
    },
  );

  const names = data?.map((pet) => pet.name);

  return names;
};

// Regression test for https://github.com/orval-labs/orval/issues/1177
//
// The generated TanStack Query mutation hook must accept an `onMutate`
// callback through its `mutation` option. `onMutate` is part of TanStack's
// `UseMutationOptions`; if orval ever narrows that option type (as it did when
// #1177 was filed), this function stops compiling and fails the typecheck.
export const useCreatePetsWithOnMutate = () =>
  useCreatePets({
    mutation: {
      onMutate: (variables) => {
        // `variables` must be the typed mutation input, not `any`.
        void variables.data;
        // @ts-expect-error - a key absent from the mutation input must error;
        // this proves `variables` is strongly typed (not `any`).
        void variables.notAField;
      },
    },
  });
