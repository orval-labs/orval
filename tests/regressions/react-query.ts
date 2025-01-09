import { useListPetsInfinite } from '../generated/react-query/mutator/endpoints';

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

  const pages = data?.pages.map((page) => page.map((pet) => pet.name)).flat();

  return pages;
};
