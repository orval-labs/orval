import {
  getListPetsInfiniteKeyLoader,
  useListPetsInfinite,
} from '../generated/swr/petstore-override-swr/endpoints';
import { isFunction, isNumber, isString } from '@orval/core';
import {
  useListPets as useListPetsWithHeaders,
  useListPetsInfinite as useListPetsInfiniteWithHeaders,
  useCreatePets,
  getCreatePetsMutationFetcher,
} from '../generated/swr/petstore-with-headers/endpoints';
import { ListPetsXExample } from '../generated/swr/petstore-with-headers/model';
import type { CreatePetsHeaders } from '../generated/swr/petstore-with-headers/model';
import {
  getListPetsArrayInfiniteKeyLoader,
  getListPetsWrappedInfiniteKeyLoader,
  getGetPetSingleInfiniteKeyLoader,
} from '../generated/swr/swr-infinite-pagination/endpoints';
import type {
  listPetsArrayResponse,
  listPetsWrappedResponse,
  getPetSingleResponse,
} from '../generated/swr/swr-infinite-pagination/endpoints';
import type {
  Pet,
  PetsWrappedResponse,
} from '../generated/swr/swr-infinite-pagination/model';

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
  return isFunction(fetcher);
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

    return isString(_url) && isNumber(_page);
  }

  return false;
};

// Direct array response (e.g., API returns Pet[], orval wraps as { data: Pet[], status, headers })
// The key loader should terminate pagination when the array is empty
export const testInfinitePaginationTerminationForArrayResponse = () => {
  const keyLoader = getListPetsArrayInfiniteKeyLoader({ limit: 10 });

  // First page - no previous data, should return key
  const firstPageKey = keyLoader(0);
  if (!firstPageKey) {
    throw new Error('First page key should not be null');
  }

  // Simulate non-empty array response (orval wrapped format)
  const nonEmptyResponse = {
    data: [{ id: 1, name: 'Fluffy' }] as Pet[],
    status: 200 as const,
    headers: new Headers(),
  };
  const secondPageKey = keyLoader(1, nonEmptyResponse as listPetsArrayResponse);
  if (!secondPageKey) {
    throw new Error(
      'Second page key should not be null when previous data is non-empty array',
    );
  }

  // Simulate empty array response - should terminate pagination
  const emptyResponse = {
    data: [] as Pet[],
    status: 200 as const,
    headers: new Headers(),
  };
  const terminatedKey = keyLoader(2, emptyResponse as listPetsArrayResponse);
  if (terminatedKey !== null) {
    throw new Error('Key should be null when previous data is empty array');
  }

  return true;
};

// Wrapped response with data array (e.g., API returns { data: Pet[], ... })
// orval wraps as { data: { data: Pet[], ... }, status, headers }
// The key loader should terminate pagination when the nested data array is empty
export const testInfinitePaginationTerminationForWrappedResponse = () => {
  const keyLoader = getListPetsWrappedInfiniteKeyLoader({ limit: 10 });

  // First page - no previous data, should return key
  const firstPageKey = keyLoader(0);
  if (!firstPageKey) {
    throw new Error('First page key should not be null');
  }

  // Simulate non-empty wrapped response (orval wrapped format)
  const nonEmptyResponse = {
    data: {
      data: [{ id: 1, name: 'Fluffy' }] as Pet[],
      status: 200,
    } as PetsWrappedResponse,
    status: 200 as const,
    headers: new Headers(),
  };
  const secondPageKey = keyLoader(
    1,
    nonEmptyResponse as listPetsWrappedResponse,
  );
  if (!secondPageKey) {
    throw new Error(
      'Second page key should not be null when previous data has non-empty array',
    );
  }

  // Simulate empty data array in wrapped response - should terminate pagination
  const emptyDataResponse = {
    data: {
      data: [] as Pet[],
      status: 200,
    } as PetsWrappedResponse,
    status: 200 as const,
    headers: new Headers(),
  };
  const terminatedKey = keyLoader(
    2,
    emptyDataResponse as listPetsWrappedResponse,
  );
  if (terminatedKey !== null) {
    throw new Error(
      'Key should be null when previous data has empty data array',
    );
  }

  return true;
};

// Single object response (non-paginated endpoint)
// The key loader should terminate pagination after first page
export const testInfinitePaginationTerminationForSingleObject = () => {
  // getGetPetSingleInfiniteKeyLoader takes no arguments (path is static)
  const keyLoader = getGetPetSingleInfiniteKeyLoader();

  // First page - no previous data, should return key
  const firstPageKey = keyLoader(0);
  if (!firstPageKey) {
    throw new Error('First page key should not be null');
  }

  // Simulate single object response (orval wrapped format)
  // Because single objects don't have 'data' property and are not arrays, pagination should stop
  const singleObjectResponse = {
    data: { id: 1, name: 'Fluffy' } as Pet,
    status: 200 as const,
    headers: new Headers(),
  };
  const terminatedKey = keyLoader(
    1,
    singleObjectResponse as getPetSingleResponse,
  );
  if (terminatedKey !== null) {
    throw new Error(
      'Key should be null for single object response (non-paginated)',
    );
  }

  return true;
};
