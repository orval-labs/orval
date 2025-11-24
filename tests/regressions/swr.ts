import {
  getListPetsInfiniteKeyLoader,
  useListPetsInfinite,
} from '../generated/swr/petstore-override-swr/endpoints';
import {
  useListPets as useListPetsWithHeaders,
  useListPetsInfinite as useListPetsInfiniteWithHeaders,
} from '../generated/swr/petstore-with-headers/endpoints';
import { ListPetsXExample } from '../generated/swr/petstore-with-headers/model';

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
