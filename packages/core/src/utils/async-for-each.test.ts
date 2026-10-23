import { describe, expect, it } from 'vite-plus/test';

import { asyncForEach } from './async-for-each';

describe('asyncForEach', () => {
  it('starts no new items after a failure and rejects with the earliest failure once in-flight calls settle', async () => {
    const started: number[] = [];
    const calls = new Map<number, PromiseWithResolvers<void>>();
    let settled = false;

    const outcome = asyncForEach([0, 1, 2, 3], 2, (item) => {
      started.push(item);
      if (item > 1) return Promise.resolve();
      const call = Promise.withResolvers<void>();
      calls.set(item, call);
      return call.promise;
    }).then(
      () => 'resolved',
      (error: Error) => error.message,
    );
    void outcome.finally(() => {
      settled = true;
    });

    calls.get(1)?.reject(new Error('item 1 failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    calls.get(0)?.reject(new Error('item 0 failed'));
    expect(await outcome).toBe('item 0 failed');
    expect(started).toEqual([0, 1]);
  });
});
