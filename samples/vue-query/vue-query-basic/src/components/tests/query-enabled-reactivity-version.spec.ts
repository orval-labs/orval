import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, waitFor } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import * as customInstanceModule from '../../api/mutator/custom-instance';
import Pet from './query-enabled-reactivity-version.vue';

describe('Query `enabled` reactivity', () => {
  it('works for multiple arguments (version and petId)', async () => {
    // this test is to ensure we don't use `unref(version && petId)` which is not correct, see https://github.com/orval-labs/orval/pull/944/files#r1347320242
    // Each argument gets its own nullish guard — see issue #3241.

    const spy = vi.spyOn(customInstanceModule, 'customInstance');

    render(Pet, {
      global: {
        plugins: [VueQueryPlugin],
      },
    });

    // make sure the query is disabled at first, because `version` is undefined (nullish)
    expect(spy).not.toHaveBeenCalled();

    // after the timeout inside of component, `version` is set to `1` and the query is enabled
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/v1/pets/123',
        }),
      );
    });
  });
});
