import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, waitFor } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import * as customInstanceModule from '../../api/mutator/custom-instance';
import Pet from './query-enabled-reactivity-pet-id.vue';

describe('Query `enabled` reactivity', () => {
  it('works', async () => {
    // this test ensures we use unref() inside the `enabled` guard, like so:
    // `enabled: computed(() => unref(petId) !== null && unref(petId) !== undefined)`
    // (nullish check, not truthiness — see issue #3241)

    const spy = vi.spyOn(customInstanceModule, 'customInstance');

    render(Pet, {
      global: {
        plugins: [VueQueryPlugin],
      },
    });

    // make sure the query is disabled at first, because `petId` is undefined (nullish)
    expect(spy).not.toHaveBeenCalled();

    // after the timeout inside of component, `overridePetId` is set to `123` and the query is enabled
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/v1/pets/123',
        }),
      );
    });
  });
});
