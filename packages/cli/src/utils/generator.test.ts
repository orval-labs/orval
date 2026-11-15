import { describe, expect, it, vi } from 'vite-plus/test';

import { loadGenerator } from './generator';

describe('loadGenerator', () => {
  it('loads an installed generator', async () => {
    const module = { default: 'generator' };
    const load = vi.fn(async () => module);

    await expect(loadGenerator('@orval/core', load)).resolves.toBe(module);
    expect(load).toHaveBeenCalledOnce();
  });

  it('identifies the missing package without invoking its loader', async () => {
    const load = vi.fn(async () => ({}));

    await expect(
      loadGenerator('@orval/not-an-installed-generator', load),
    ).rejects.toThrow(
      'Generator package "@orval/not-an-installed-generator" is not installed. Install @orval/not-an-installed-generator@',
    );
    expect(load).not.toHaveBeenCalled();
  });

  it('preserves a missing dependency error from an installed generator', async () => {
    const error = Object.assign(new Error('Missing transitive dependency'), {
      code: 'ERR_MODULE_NOT_FOUND',
    });

    await expect(
      loadGenerator('@orval/core', () => Promise.reject(error)),
    ).rejects.toBe(error);
  });
});
