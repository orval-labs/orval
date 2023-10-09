import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, screen, waitFor } from '@testing-library/vue';
import { rest } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import Pets from './pets.vue';

describe('Query parameters reactivity', () => {
  it('works', async () => {
    server.use(
      rest.get('*/v:version/pets', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json(
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
              pet.tag.includes(req.url.searchParams.get('filter') ?? ''),
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
