import { expect, test } from 'vite-plus/test';

import {
  getListPetsInfiniteQueryKey,
  getListPetsQueryKey,
  getShowPetByIdQueryKey,
  useListPetsInfiniteQueryOptions,
  useListPetsQueryOptions,
  useShowPetByIdQueryOptions,
} from './generated/react-query/custom-query-key-mutator/endpoints';

// Regression tests for query key factories with a custom queryKey mutator:
// the factories must be generated and must produce the same key the
// generated query options compute internally, so consumers can invalidate
// or read the cache without rebuilding full query options.

const headers = { 'X-EXAMPLE': 'ONE' } as const;

test('key factory builds the key through the mutator', () => {
  expect(getListPetsQueryKey({ sort: 'name' }, headers)).toEqual([
    'tenant-abc',
    '/pets',
    { params: { sort: 'name' }, headers },
  ]);
});

test('key factory interpolates path params into the url', () => {
  expect(getShowPetByIdQueryKey('42')).toEqual([
    'tenant-abc',
    '/pets/42',
    { petId: '42' },
  ]);
});

test('key factory matches the key inside generated query options', () => {
  expect(getListPetsQueryKey({ sort: 'name' }, headers)).toEqual(
    useListPetsQueryOptions({ sort: 'name' }, headers).queryKey,
  );
  expect(getShowPetByIdQueryKey('42')).toEqual(
    useShowPetByIdQueryOptions('42').queryKey,
  );
});

test('infinite key factory matches the infinite query options key', () => {
  expect(getListPetsInfiniteQueryKey({ sort: 'name' }, headers)).toEqual(
    useListPetsInfiniteQueryOptions({ sort: 'name' }, headers).queryKey,
  );
});
