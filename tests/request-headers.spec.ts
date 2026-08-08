import { afterEach, expect, test, vi } from 'vitest';

import { createPets as createPetsWithMutator } from './generated/fetch/mutator/endpoints';
import { createPets } from './generated/fetch/request-options-headers/endpoints';

const { customFetchMock } = vi.hoisted(() => ({
  customFetchMock: vi.fn(),
}));

vi.mock('./mutators/custom-fetch', () => ({
  customFetch: customFetchMock,
}));

afterEach(() => {
  customFetchMock.mockReset();
  vi.unstubAllGlobals();
});

const headerCases: Array<{
  name: string;
  headers: HeadersInit;
  traceValue: string;
}> = [
  {
    name: 'Headers',
    headers: new Headers({
      authorization: 'runtime-token',
      'content-type': 'application/custom+json',
      'x-trace': 'headers',
    }),
    traceValue: 'headers',
  },
  {
    name: 'tuple array',
    headers: [
      ['authorization', 'runtime-token'],
      ['content-type', 'application/custom+json'],
      ['x-trace', 'tuples'],
    ],
    traceValue: 'tuples',
  },
  {
    name: 'record',
    headers: {
      authorization: 'runtime-token',
      'content-type': 'application/custom+json',
      'x-trace': 'record',
    },
    traceValue: 'record',
  },
];

test.each(headerCases)(
  'merges $name request headers over generated headers',
  async ({ headers, traceValue }) => {
    let requestHeaders: Headers | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestHeaders = new Headers(init?.headers);
        return new Response('{}', { status: 200 });
      }),
    );

    await createPets(
      { name: 'Fluffy', tag: 'cat' },
      { sort: 'name' },
      { headers },
    );

    expect(requestHeaders?.get('authorization')).toBe('runtime-token');
    expect(requestHeaders?.get('content-type')).toBe(
      'application/custom+json',
    );
    expect(requestHeaders?.get('x-trace')).toBe(traceValue);
    expect(requestHeaders?.get('x-static-header')).toBe('static-value');
  },
);

test('passes merged headers as a record to a custom mutator', async () => {
  customFetchMock.mockResolvedValue({ data: {}, status: 200 });

  await createPetsWithMutator(
    { name: 'Fluffy', tag: 'cat' },
    { sort: 'name' },
    { headers: new Headers({ 'x-trace': 'headers' }) },
  );

  const requestOptions = customFetchMock.mock.calls[0]?.[1] as
    | RequestInit
    | undefined;
  expect(requestOptions?.headers).not.toBeInstanceOf(Headers);
  expect(requestOptions?.headers).toMatchObject({
    'content-type': 'application/json',
    'x-trace': 'headers',
  });
});
