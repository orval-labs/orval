import type { QueryClient } from '@tanstack/vue-query';

import { getListPetsQueryOptions } from '../generated/vue-query/mutator/endpoints';
import type { Pets } from '../generated/vue-query/mutator/model';

export const getCachedPets = (queryClient: QueryClient) => {
  const pets = queryClient.getQueryData(
    getListPetsQueryOptions({ sort: 'name' }).queryKey,
  );
  const typed: Pets | undefined = pets;
  return typed;
};
