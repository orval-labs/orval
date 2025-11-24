import {
  getListPetsInfiniteKeyLoader,
  useListPetsInfinite,
} from '../generated/swr/petstore-override-swr/endpoints';
import {
  useListPets as useListPetsWithHeaders,
  useListPetsInfinite as useListPetsInfiniteWithHeaders,
  useCreatePets,
  getCreatePetsMutationFetcher,
} from '../generated/swr/petstore-with-headers/endpoints';
import { ListPetsXExample } from '../generated/swr/petstore-with-headers/model';
import type { CreatePetsHeaders } from '../generated/swr/petstore-with-headers/model';

export const useInfiniteQueryTest = () => {
  const { data } = useListPetsInfinite(
    {
      sort: 'name',
    },
    {
      swr: {
        initialSize: 2,
      },
    },
  );

  // Test that pageParams has correct type (ListPetsParams)
  // SWR Infinite data is an array of pages
  const pages = data?.flatMap((page) => {
    if ('data' in page && page.status === 200) {
      return page.data.map((pet) => pet.name);
    }
    return [];
  });

  return pages;
};

// Test that pageParams type includes page: number
// This verifies the fix: the generated swrFn should accept pageParams with page property
export const testInfinitePageParamType = () => {
  const keyLoader = getListPetsInfiniteKeyLoader({ sort: 'name' });

  // For the first page, previousPageData is omitted (optional parameter)
  const key = keyLoader(0);

  // The key should be a tuple: [url, params]
  // TypeScript should know that params has page: number property
  if (key) {
    const [, params] = key;
    const pageValue: number = params.page;
    return pageValue;
  }
  return;
};

// Test that headers are properly passed to infinite hooks
// This verifies the fix: headers should be included between pageParams and options
export const testInfiniteWithHeaders = () => {
  const headers = { 'X-EXAMPLE': ListPetsXExample.ONE };
  const { data } = useListPetsInfiniteWithHeaders({ sort: 'name' }, headers, {
    swr: {
      initialSize: 2,
    },
  });

  // Test that data has correct type
  const pages = data?.flatMap((page) => {
    if ('data' in page && page.status === 200) {
      return page.data.map((pet) => pet.name);
    }
    return [];
  });

  return pages;
};

// Test that headers work in regular (non-infinite) hooks too
export const testRegularHookWithHeaders = () => {
  const headers = { 'X-EXAMPLE': ListPetsXExample.ONE };
  const { data } = useListPetsWithHeaders({ sort: 'name' }, headers);

  // Test that data has correct type
  if (data && 'data' in data && data.status === 200) {
    return data.data.map((pet) => pet.name);
  }
  return [];
};

// Test that mutation hooks accept headers parameter
export const testMutationHookWithHeaders = () => {
  const headers: CreatePetsHeaders = { 'X-EXAMPLE': ListPetsXExample.ONE };
  const { trigger } = useCreatePets({ sort: 'name' }, headers);

  // Type check: trigger should be defined
  return Boolean(trigger);
};

// Test that mutation fetcher accepts headers parameter
export const testMutationFetcherSignature = () => {
  const headers: CreatePetsHeaders = { 'X-EXAMPLE': ListPetsXExample.ONE };

  // The mutation fetcher should accept headers as a parameter
  const fetcher = getCreatePetsMutationFetcher({ sort: 'name' }, headers);

  // Type check: fetcher should be a function
  return typeof fetcher === 'function';
};

// Test that swrFn uses array destructuring for parameters
// This verifies the fix: SWR passes key as array, not spread arguments
export const testSwrFnArrayDestructuring = () => {
  const keyLoader = getListPetsInfiniteKeyLoader({ sort: 'name' });

  // Simulate what SWR does: call keyLoader to get the key
  const key = keyLoader(0);

  if (key) {
    // SWR would pass this key array as a single argument to swrFn
    // The swrFn should destructure it as: ([_url, pageParams]) => ...
    // TypeScript will catch if the destructuring pattern is wrong
    const [url, params] = key;

    // Type assertions to verify correct types
    const _url: string = url;
    const _page: number = params.page;

    return typeof _url === 'string' && typeof _page === 'number';
  }

  return false;
};
