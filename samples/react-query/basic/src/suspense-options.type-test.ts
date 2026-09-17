import { QueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { DataTag, QueryKey } from '@tanstack/react-query';
import { getListPetsSuspenseQueryOptions, useListPetsSuspense } from './api/endpoints/petstoreFromFileSpecWithTransformer';

class CustomError extends Error {
  readonly code = 'custom';
}

// Compile-only regression coverage for #1788 and the public suspense contract.
export function useSuspenseOptionsTypeRegression() {
  const options = getListPetsSuspenseQueryOptions<string[], CustomError>(undefined, 1, {
    query: { select: (pets) => pets.map((pet) => pet.name) },
  });
  const key: DataTag<QueryKey, string[], CustomError> = options.queryKey;
  new QueryClient().setQueryData(key, ['pet']);
  const single = useSuspenseQuery(options);
  const [multiple] = useSuspenseQueries({ queries: [options] });
  useSuspenseQueries({ queries: [getListPetsSuspenseQueryOptions()] });
  const hook = useListPetsSuspense<string[], CustomError>();
  const hookKey: typeof hook.queryKey = options.queryKey;
  const data: string[] = multiple.data;
  const singleData: string[] = single.data;
  const error: CustomError | null = multiple.error;
  type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2) ? true : false;
  const exactError: Equal<typeof multiple.error, CustomError | null> = true;
  const exactData: Equal<typeof multiple.data, string[]> = true;
  // @ts-expect-error Suspense options must not expose enabled.
  void options.enabled;
  // @ts-expect-error The inference-only member cannot configure throwOnError.
  void (options.throwOnError = () => true);
  // @ts-expect-error The inference-only member cannot be called.
  void options.throwOnError?.(new CustomError());
  // @ts-expect-error Suspense options must not expose placeholderData.
  void options.placeholderData;
  return { data, singleData, error, hookKey, exactError, exactData };
}
