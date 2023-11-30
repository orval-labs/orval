import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, waitFor } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';
import * as customInstanceModule from '../../api/mutator/custom-instance';
import Pet from './url-encode.vue';

describe('URL encode', () => {
  it('works', async () => {
    // this test is to ensure we have `/v${encodeURIComponent(String(unref(petId)))}/pets` instead of `/v${unref(petId)}/pets`

    const spy = vi.spyOn(customInstanceModule, 'customInstance');

    render(Pet, {
      props: {
        petId: '?me=yes&you',
      },
      global: {
        plugins: [VueQueryPlugin],
      },
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/v1/pets/%3Fme%3Dyes%26you', // NOT `/v1/pets/?me=yes&you`
        }),
      );
    });
  });
});
