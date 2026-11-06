import { QueryClient } from '@tanstack/solid-query';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

import {
  useListPets,
  useShowPetById,
} from './generated/solid-query/named-parameters/endpoints';
import { useShowPetById as useShowPetByIdPositional } from './generated/solid-query/petstore/endpoints';

// Generated solid-query hooks accept a signal (or any accessor) for each
// parameter and for `options`, and re-run the query when it changes (#3195).
// A Solid component body runs once, so a hook that only took plain values froze
// them at first render: navigating from /pets/1 to /pets/2 never refetched.
//
// Runs on Solid's client build (see `vitest.snapshots.ts`); the server build
// that Node resolves by default has no reactivity.

const requestedUrls: string[] = [];

beforeEach(() => {
  requestedUrls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ id: 1, name: 'Rex' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const waitForRequests = (count: number) =>
  vi.waitFor(() => {
    expect(requestedUrls).toHaveLength(count);
  });

test('refetches when a positional path param signal changes', async () => {
  const queryClient = newQueryClient();
  const [petId, setPetId] = createSignal('1');

  await createRoot(async (dispose) => {
    const query = useShowPetByIdPositional(
      petId,
      1,
      undefined,
      () => queryClient,
    );

    await waitForRequests(1);
    expect(requestedUrls[0]).toBe('/v1/pets/1');
    expect(query.queryKey).toEqual(['/v1/pets/1']);

    setPetId('2');

    await waitForRequests(2);
    expect(requestedUrls[1]).toBe('/v1/pets/2');
    // The returned queryKey follows the current parameters.
    expect(query.queryKey).toEqual(['/v1/pets/2']);

    dispose();
  });
});

test('refetches when a named path params signal changes', async () => {
  const queryClient = newQueryClient();
  const [pathParams, setPathParams] = createSignal({ petId: '1' });

  await createRoot(async (dispose) => {
    // `version` is left out so the factory's default (1) still applies after
    // the accessor is resolved.
    useShowPetById(pathParams, undefined, () => queryClient);

    await waitForRequests(1);
    expect(requestedUrls[0]).toBe('/v1/pets/1');

    setPathParams({ petId: '7' });

    await waitForRequests(2);
    expect(requestedUrls[1]).toBe('/v1/pets/7');

    dispose();
  });
});

test('reacts to an options signal', async () => {
  const queryClient = newQueryClient();
  const [enabled, setEnabled] = createSignal(false);

  await createRoot(async (dispose) => {
    useListPets(
      {},
      { limit: '10', sort: 'name' },
      () => ({ query: { enabled: enabled() } }),
      () => queryClient,
    );

    // Give a disabled query the chance to (wrongly) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestedUrls).toHaveLength(0);

    setEnabled(true);

    await waitForRequests(1);
    expect(requestedUrls[0]).toBe('/v1/pets?limit=10&sort=name');

    dispose();
  });
});

test('still accepts plain values', async () => {
  const queryClient = newQueryClient();

  await createRoot(async (dispose) => {
    const query = useShowPetByIdPositional(
      '3',
      1,
      undefined,
      () => queryClient,
    );

    await waitForRequests(1);
    expect(requestedUrls[0]).toBe('/v1/pets/3');
    expect(query.queryKey).toEqual(['/v1/pets/3']);

    dispose();
  });
});
