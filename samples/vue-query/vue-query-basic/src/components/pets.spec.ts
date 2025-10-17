import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, screen, waitFor } from '@testing-library/vue';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import Pets from './pets.vue';

describe('Query parameters reactivity', () => {
  it('works', async () => {
    server.use(
      http.get('*/v:version/pets', ({ request }) => {
        const url = new URL(request.url);
        return new Response(
          JSON.stringify(
            [
              {
                id: 1,
                name: 'Dog',
                tag: 'dog',
              },
              {
                id: 2,
                name: 'Cat',
                tag: 'cat',
              },
              {
                id: 3,
                name: 'Bird',
                tag: 'bird',
              },
            ].filter((pet) =>
              pet.tag.includes(url.searchParams.get('filter') ?? ''),
            ),
          ),
        );
      }),
    );

    render(Pets, {
      global: {
        plugins: [VueQueryPlugin],
      },
    });

    // console.log(screen.debug());

    // check that only dog is rendered
    await waitFor(() => {
      expect(screen.getAllByText('Dog')).toHaveLength(1);
      expect(screen.queryByText('Cat')).toBeNull();
      expect(screen.getAllByTestId('pet-name')).toHaveLength(1);
    });

    // console.log(screen.debug());

    // check that only cat is rendered
    await waitFor(
      () => {
        expect(screen.getAllByText('Cat')).toHaveLength(1);
        expect(screen.queryByText('Dog')).toBeNull();
        expect(screen.getAllByTestId('pet-name')).toHaveLength(1);
      },
      {
        timeout: 5000,
      },
    );

    // console.log(screen.debug());
  }, 10000);
});
