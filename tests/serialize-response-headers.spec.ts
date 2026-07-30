import { dehydrate, QueryClient } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';

import { listPets } from './generated/fetch/serialize-response-headers/endpoints';
import { prefetchListPetsQuery } from './generated/react-query/prefetch-serializable-headers/endpoints';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respondWith = (headers: Headers) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers })),
  );
};

test('serialized headers survive the structured clone that dehydrate() performs', async () => {
  respondWith(
    new Headers({
      'content-type': 'application/json',
      'x-total-count': '2',
    }),
  );

  const response = await listPets({});

  expect(response.headers).not.toBeInstanceOf(Headers);
  expect(response.headers).toEqual({
    'content-type': 'application/json',
    'x-total-count': '2',
  });
  // A `Headers` instance raises DataCloneError here.
  expect(() => structuredClone(response)).not.toThrow();
});

test('set-cookie never reaches the serialized response', async () => {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append('set-cookie', 'session=secret; HttpOnly');
  headers.append('set-cookie', 'refresh=rotate-me');
  respondWith(headers);

  const response = await listPets({});

  expect(response.headers).not.toHaveProperty('set-cookie');
  expect(JSON.stringify(response.headers)).not.toContain('secret');
});

test('prefetchListPetsQuery yields a dehydrated cache that crosses the RSC boundary', async () => {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append('set-cookie', 'session=secret; HttpOnly');
  respondWith(headers);

  const queryClient = new QueryClient();
  await prefetchListPetsQuery(queryClient, {});
  const state = dehydrate(queryClient);

  expect(state.queries).toHaveLength(1);
  const cached = state.queries[0].state.data as { headers: unknown };
  expect(cached.headers).not.toBeInstanceOf(Headers);
  expect(cached.headers).not.toHaveProperty('set-cookie');
  expect(() => structuredClone(state)).not.toThrow();
});
