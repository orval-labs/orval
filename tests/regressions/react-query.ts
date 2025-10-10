import { keepPreviousData } from '@tanstack/react-query';

import {
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
