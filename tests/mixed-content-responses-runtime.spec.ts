import { afterEach, expect, test, vi } from 'vite-plus/test';

import {
  getData,
  getMixedSuccess,
} from './generated/fetch/mixed-content-responses/endpoints';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respondWith = (status: number, contentType: string, body = '') => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(body, {
          status,
          headers: { 'content-type': contentType },
        }),
    ),
  );
};

test('decodes an empty text/plain body as an empty string', async () => {
  respondWith(429, 'text/plain');
  expect((await getData()).data).toBe('');

  respondWith(206, 'text/plain');
  expect((await getMixedSuccess()).data).toBe('');
});

test('keeps the fallbacks of empty JSON and no-content responses', async () => {
  respondWith(200, 'application/json');
  expect((await getData()).data).toEqual({});

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 200 })),
  );
  expect((await getData()).data).toEqual({});
});
